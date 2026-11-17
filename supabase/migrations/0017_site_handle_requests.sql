-- Site address (handle) changes go through the super admins.
-- Site admins can no longer change their own handle; they file a change request instead.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. (여러 번 실행해도 괜찮아요.)

begin;

-- 1) Only super admins may change sites.handle (direct table updates by anyone else keep the old value).
create or replace function public.guard_site_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() and auth.uid() is not null then
    new.handle := old.handle;
    new.status := old.status;
    new.active_from := old.active_from;
    new.active_until := old.active_until;
    new.service_started_on := old.service_started_on;
    new.admin_memo := old.admin_memo;
    new.newsletter_limit := old.newsletter_limit;
    new.text_token_limit := old.text_token_limit;
    new.image_token_limit := old.image_token_limit;
  end if;
  return new;
end $$;

-- Same address rules as the app (src/lib/site.ts).
create or replace function public.site_handle_problem(p_handle text, p_site uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_handle !~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$' then 'invalid'
    when p_handle = any (array['www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp', 'dashboard', 'login', 'help',
      'support', 'blog', 'docs', 'status', 'static', 'assets', 'cdn', 'dev', 'test', 'leadstation', 'staging']) then 'reserved'
    when exists (select 1 from public.sites where handle = p_handle and id is distinct from p_site) then 'taken'
    else null
  end;
$$;
revoke all on function public.site_handle_problem(text, uuid) from public, anon;

-- 2) Change requests -------------------------------------------------------------------
create table if not exists public.site_handle_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  current_handle text not null,
  new_handle text not null check (new_handle ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$'),
  reason text not null default '' check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected', 'canceled')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists site_handle_requests_status_idx on public.site_handle_requests (status, created_at desc);
create index if not exists site_handle_requests_site_idx on public.site_handle_requests (site_id, created_at desc);
-- One open request per site.
create unique index if not exists site_handle_requests_one_pending on public.site_handle_requests (site_id) where status = 'pending';

alter table public.site_handle_requests enable row level security;
drop policy if exists "members read handle requests" on public.site_handle_requests;
create policy "members read handle requests" on public.site_handle_requests for select to authenticated
  using (public.is_site_member(site_id) or public.is_super_admin());
-- No insert/update/delete policies: all writes go through the functions below.

-- Site admin files a request for the working site.
create or replace function public.request_site_handle_change(p_new_handle text, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid := public.current_site_id(); cur text; h text := lower(trim(coalesce(p_new_handle, ''))); prob text; rid uuid;
begin
  if sid is null then raise exception 'no site'; end if;
  if not public.is_site_admin(sid) then raise exception 'not allowed' using errcode = '42501'; end if;
  select handle into cur from public.sites where id = sid;
  if h = cur then raise exception 'same handle' using errcode = 'P0006'; end if;
  prob := public.site_handle_problem(h, sid);
  if prob = 'taken' then raise exception 'handle taken' using errcode = '23505'; end if;
  if prob is not null then raise exception 'bad handle' using errcode = 'P0007'; end if;
  if exists (select 1 from public.site_handle_requests where site_id = sid and status = 'pending') then
    raise exception 'already requested' using errcode = 'P0005';
  end if;
  insert into public.site_handle_requests (site_id, user_id, current_handle, new_handle, reason)
  values (sid, auth.uid(), cur, h, left(trim(coalesce(p_reason, '')), 1000))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.request_site_handle_change(text, text) from public, anon;
grant execute on function public.request_site_handle_change(text, text) to authenticated;

-- Site admin withdraws the open request of the working site.
create or replace function public.cancel_site_handle_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.site_handle_requests
     set status = 'canceled', handled_at = now()
   where id = p_id and status = 'pending' and public.is_site_admin(site_id);
end $$;
revoke all on function public.cancel_site_handle_request(uuid) from public, anon;
grant execute on function public.cancel_site_handle_request(uuid) to authenticated;

-- Super admin changes a site's address, optionally answering a request.
-- Any open request of that site is closed, and its requester gets a dashboard notification.
create or replace function public.admin_set_site_handle(p_site uuid, p_handle text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare h text := lower(trim(coalesce(p_handle, ''))); prob text; r public.site_handle_requests;
begin
  if not public.is_super_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  prob := public.site_handle_problem(h, p_site);
  if prob = 'taken' then raise exception 'handle taken' using errcode = '23505'; end if;
  if prob is not null then raise exception 'bad handle' using errcode = 'P0007'; end if;
  update public.sites set handle = h where id = p_site;
  if not found then raise exception 'no site'; end if;
  update public.site_handle_requests
     set status = case when new_handle = h then 'done' else 'rejected' end,
         admin_note = left(coalesce(p_note, ''), 1000), handled_at = now()
   where site_id = p_site and status = 'pending'
   returning * into r;
  if r.id is not null and r.user_id is not null then
    insert into public.notifications (user_id, site_id, kind, title, body, ref_id)
    values (r.user_id, r.site_id, 'handle_request', '사이트 주소가 바뀌었어요',
      '새 사이트 주소는 ' || h || ' 이에요.' || case when coalesce(p_note, '') <> '' then ' ' || p_note else '' end, r.id);
  end if;
end $$;
revoke all on function public.admin_set_site_handle(uuid, text, text) from public, anon;
grant execute on function public.admin_set_site_handle(uuid, text, text) to authenticated;

-- Super admin turns a request down.
create or replace function public.reject_site_handle_request(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.site_handle_requests;
begin
  if not public.is_super_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.site_handle_requests
     set status = 'rejected', admin_note = left(coalesce(p_note, ''), 1000), handled_at = now()
   where id = p_id and status = 'pending'
   returning * into r;
  if r.id is null or r.user_id is null then return; end if;
  insert into public.notifications (user_id, site_id, kind, title, body, ref_id)
  values (r.user_id, r.site_id, 'handle_request', '사이트 주소 변경 요청에 답변이 왔어요',
    coalesce(nullif(p_note, ''), '요청하신 주소(' || r.new_handle || ')로는 바꾸기 어려워요.'), r.id);
end $$;
revoke all on function public.reject_site_handle_request(uuid, text) from public, anon;
grant execute on function public.reject_site_handle_request(uuid, text) to authenticated;

commit;
