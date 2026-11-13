-- LEADstation: dashboard notifications, requests to join a site, and per-user activity history.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. (0006 을 먼저 실행해야 해요.)

begin;

-- 1. Notifications (each row is for one person; reading it removes it from the dashboard) ----
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  site_id uuid references public.sites (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own notifications delete" on public.notifications;
create policy "own notifications delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.notify_site_admins(p_site uuid, p_kind text, p_title text, p_body text, p_ref uuid, p_except uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, site_id, kind, title, body, ref_id)
  select m.user_id, p_site, p_kind, p_title, p_body, p_ref
  from public.site_members m
  where m.site_id = p_site and m.role = 'admin' and m.user_id is distinct from p_except;
$$;
revoke all on function public.notify_site_admins(uuid, text, text, text, uuid, uuid) from public, anon, authenticated;

-- Name to show for a user: full name, otherwise email.
create or replace function public.user_label(p_user uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce(nullif((select full_name from public.profiles where user_id = p_user), ''),
                  (select email::text from auth.users where id = p_user), '알 수 없음');
$$;

-- 2. Requests to join an existing site ------------------------------------------------
create table if not exists public.site_join_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (site_id, user_id)
);
alter table public.site_join_requests enable row level security;
drop policy if exists "own or admin reads requests" on public.site_join_requests;
create policy "own or admin reads requests" on public.site_join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_site_admin(site_id));
drop policy if exists "own cancels request" on public.site_join_requests;
create policy "own cancels request" on public.site_join_requests for delete to authenticated using (user_id = auth.uid());

-- Asks to join the site at p_handle. Its admins get a notification.
create or replace function public.request_site_join(p_handle text)
returns text language plpgsql security definer set search_path = public as $$
declare s record; rid uuid; who text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id, handle, name into s from public.sites where handle = lower(trim(p_handle));
  if s.id is null then raise exception 'site not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.site_members where site_id = s.id and user_id = auth.uid()) then
    raise exception 'already a member' using errcode = 'P0003';
  end if;
  insert into public.site_join_requests (site_id, user_id) values (s.id, auth.uid())
    on conflict (site_id, user_id) do update set status = 'pending', created_at = now(), answered_at = null
    returning id into rid;
  delete from public.notifications where ref_id = rid;
  who := public.user_label(auth.uid());
  perform public.notify_site_admins(s.id, 'join_request', who || ' 님이 사이트 이용을 신청했어요',
    coalesce((select email::text from auth.users where id = auth.uid()), '') ||
    coalesce(nullif(' · ' || (select company from public.profiles where user_id = auth.uid()), ' · '), ''),
    rid, null);
  return coalesce(nullif(s.name, ''), s.handle);
end $$;

-- Admin approves (joins as a member) or declines a request.
create or replace function public.answer_join_request(p_id uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r record; sname text;
begin
  select * into r from public.site_join_requests where id = p_id;
  if r.id is null then raise exception 'request not found'; end if;
  if not public.is_site_admin(r.site_id) then raise exception 'only admins can answer'; end if;
  select coalesce(nullif(name, ''), handle) into sname from public.sites where id = r.site_id;
  update public.site_join_requests set status = case when p_approve then 'approved' else 'rejected' end, answered_at = now() where id = p_id;
  -- The request is handled: remove it from every admin's notifications.
  update public.notifications set read_at = now() where ref_id = p_id and read_at is null;
  if p_approve then
    insert into public.site_members (site_id, user_id, role) values (r.site_id, r.user_id, 'member') on conflict do nothing;
    insert into public.profiles (user_id, active_site_id) values (r.user_id, r.site_id) on conflict (user_id) do nothing;
    update public.profiles set active_site_id = r.site_id where user_id = r.user_id and active_site_id is null;
    insert into public.notifications (user_id, site_id, kind, title) values (r.user_id, r.site_id, 'join_approved', sname || ' 사이트 이용 신청이 승인됐어요');
  end if;
  return case when p_approve then 'approved' else 'rejected' end;
end $$;

-- Invited people who sign up: join and tell the admins.
create or replace function public.accept_site_invites()
returns int language plpgsql security definer set search_path = public, auth as $$
declare e text; n int := 0; r record;
begin
  select lower(email) into e from auth.users where id = auth.uid();
  if e is null then return 0; end if;
  for r in select * from public.site_invites where email = e loop
    insert into public.site_members (site_id, user_id, role) values (r.site_id, auth.uid(), r.role) on conflict do nothing;
    insert into public.profiles (user_id, active_site_id) values (auth.uid(), r.site_id) on conflict (user_id) do nothing;
    update public.profiles set active_site_id = r.site_id where user_id = auth.uid() and active_site_id is null;
    perform public.notify_site_admins(r.site_id, 'member_joined', e || ' 님이 초대를 받아 사이트에 합류했어요', '', null, auth.uid());
    n := n + 1;
  end loop;
  delete from public.site_invites where email = e;
  return n;
end $$;

grant execute on function public.request_site_join(text) to authenticated;
grant execute on function public.answer_join_request(uuid, boolean) to authenticated;
grant execute on function public.user_label(uuid) to authenticated;
revoke all on function public.request_site_join(text) from public, anon;
revoke all on function public.answer_join_request(uuid, boolean) from public, anon;

-- 3. Activity history, written automatically by triggers -------------------------------
create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  title text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_site_idx on public.activity_logs (site_id, created_at desc);
create index if not exists activity_logs_user_idx on public.activity_logs (site_id, user_id, created_at desc);
alter table public.activity_logs enable row level security;
drop policy if exists "site members read activity" on public.activity_logs;
create policy "site members read activity" on public.activity_logs for select to authenticated using (public.is_site_member(site_id));

-- Records one action. Repeated saves of the same item by the same person within 10 minutes count once.
create or replace function public.log_activity(p_site uuid, p_action text, p_type text, p_target uuid, p_title text)
returns void language plpgsql security definer set search_path = public as $$
declare last_id bigint;
begin
  if auth.uid() is null or p_site is null then return; end if;
  if p_action = 'updated' then
    select id into last_id from public.activity_logs
     where site_id = p_site and user_id = auth.uid() and target_id = p_target and action in ('updated', 'created')
       and created_at > now() - interval '10 minutes'
     order by created_at desc limit 1;
    if last_id is not null then return; end if;
  end if;
  insert into public.activity_logs (site_id, user_id, action, target_type, target_id, title)
  values (p_site, auth.uid(), p_action, p_type, p_target, left(coalesce(p_title, ''), 200));
end $$;
revoke all on function public.log_activity(uuid, text, text, uuid, text) from public, anon, authenticated;

-- Row triggers for pages, articles and newsletters: created, edited, published/unpublished, deleted.
create or replace function public.track_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text := tg_argv[0]; label text;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.site_id, 'created', t, new.id, new.title);
  elsif tg_op = 'DELETE' then
    perform public.log_activity(old.site_id, 'deleted', t, old.id, old.title);
  else
    label := coalesce(nullif(new.title, ''), old.title);
    if t <> 'newsletter' and new.status is distinct from old.status then
      perform public.log_activity(new.site_id, case when new.status = 'published' then 'published' else 'unpublished' end, t, new.id, label);
    elsif t = 'newsletter' and new.status is distinct from old.status then
      null; -- sending is logged from campaigns
    else
      perform public.log_activity(new.site_id, 'updated', t, new.id, label);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists pages_activity on public.pages;
create trigger pages_activity after insert or update or delete on public.pages for each row execute function public.track_item('page');
drop trigger if exists articles_activity on public.articles;
create trigger articles_activity after insert or update or delete on public.articles for each row execute function public.track_item('article');
drop trigger if exists newsletters_activity on public.newsletters;
create trigger newsletters_activity after insert or update or delete on public.newsletters for each row execute function public.track_item('newsletter');

create or replace function public.track_campaign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity(new.site_id, case when new.status = 'scheduled' then 'scheduled' else 'sent' end,
    'newsletter', new.newsletter_id, new.subject || ' (' || new.total || '명)');
  return null;
end $$;
drop trigger if exists campaigns_activity on public.campaigns;
create trigger campaigns_activity after insert on public.campaigns for each row execute function public.track_campaign();

create or replace function public.track_media()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity(new.site_id, case when new.source = 'ai' then 'generated' else 'uploaded' end,
    'media', new.id, left(coalesce(nullif(new.prompt, ''), '이미지'), 80));
  return null;
end $$;
drop trigger if exists media_activity on public.media;
create trigger media_activity after insert on public.media for each row execute function public.track_media();

-- Recipients come in bulk (CSV import), so they are logged once per statement with a count.
create or replace function public.track_recipients()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select site_id, count(*) n from new_rows group by site_id loop
    perform public.log_activity(r.site_id, 'added', 'recipients', null, '수신자 ' || r.n || '명');
  end loop;
  return null;
end $$;
drop trigger if exists recipients_activity on public.recipients;
create trigger recipients_activity after insert on public.recipients referencing new table as new_rows
  for each statement execute function public.track_recipients();

create or replace function public.track_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.site_id, 'member_added', 'member', new.user_id, public.user_label(new.user_id));
  elsif tg_op = 'DELETE' then
    perform public.log_activity(old.site_id, 'member_removed', 'member', old.user_id, public.user_label(old.user_id));
  elsif new.role is distinct from old.role then
    perform public.log_activity(new.site_id, 'role_changed', 'member', new.user_id,
      public.user_label(new.user_id) || ' → ' || case when new.role = 'admin' then '관리자' else '사용자' end);
  end if;
  return null;
end $$;
drop trigger if exists site_members_activity on public.site_members;
create trigger site_members_activity after insert or update or delete on public.site_members for each row execute function public.track_members();

commit;
