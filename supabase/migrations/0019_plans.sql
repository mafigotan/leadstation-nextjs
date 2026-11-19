-- LEADstation: plans (FREE / BASIC / STANDARD / PRO / CUSTOM) set by super admins with offline payments.
-- One combined AI limit (text tokens + 4,000 per image), plus subscriber, storage and member limits.
-- New sites start on FREE for 30 days.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. (0018 다음)

begin;

-- 1. Plans ---------------------------------------------------------------------------
-- Limits are per month for AI and newsletter, totals for the rest. Empty = no limit.
create table if not exists public.plans (
  code text primary key,
  name text not null,
  monthly_price bigint,             -- null = 협의 (CUSTOM)
  trial_days int,                   -- FREE: fixed length instead of months
  ai_token_limit bigint,
  newsletter_limit bigint,
  subscriber_limit bigint,
  storage_mb_limit bigint,
  member_limit bigint,
  sort int not null default 0
);
alter table public.plans enable row level security;
drop policy if exists "anyone reads plans" on public.plans;
create policy "anyone reads plans" on public.plans for select using (true);
drop policy if exists "super admins manage plans" on public.plans;
create policy "super admins manage plans" on public.plans for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
grant select on public.plans to anon, authenticated;
grant insert, update, delete on public.plans to authenticated;

insert into public.plans (code, name, monthly_price, trial_days, ai_token_limit, newsletter_limit, subscriber_limit, storage_mb_limit, member_limit, sort) values
  ('free',     'FREE',     0,      30,   350000,  300,   300,   500,   1,  1),
  ('basic',    'BASIC',    50000,  null, 750000,  3000,  2000,  2048,  2,  2),
  ('standard', 'STANDARD', 70000,  null, 1300000, 8000,  5000,  5120,  5,  3),
  ('pro',      'PRO',      100000, null, 2200000, 15000, 15000, 20480, 10, 4),
  ('custom',   'CUSTOM',   null,   null, null,    null,  null,  null,  null, 5)
on conflict (code) do nothing;

-- 2. Site plan and per-site limits ---------------------------------------------------------
-- A site's limit is its own value when set, otherwise its plan's. Sites without a plan keep their own values.
alter table public.sites add column if not exists plan text references public.plans (code);
alter table public.sites add column if not exists ai_token_limit bigint check (ai_token_limit >= 0);
alter table public.sites add column if not exists subscriber_limit bigint check (subscriber_limit >= 0);
alter table public.sites add column if not exists storage_mb_limit bigint check (storage_mb_limit >= 0);
alter table public.sites add column if not exists member_limit bigint check (member_limit >= 0);
grant select (plan, ai_token_limit, subscriber_limit, storage_mb_limit, member_limit) on public.sites to anon, authenticated;
grant update (plan, ai_token_limit, subscriber_limit, storage_mb_limit, member_limit) on public.sites to authenticated;

-- Existing sites: the two AI limits become one (no limit if either had none).
update public.sites set ai_token_limit = text_token_limit + image_token_limit
 where ai_token_limit is null and text_token_limit is not null and image_token_limit is not null;

alter table public.site_payments add column if not exists plan text references public.plans (code);

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
    new.plan := old.plan;
    new.ai_token_limit := old.ai_token_limit;
    new.subscriber_limit := old.subscriber_limit;
    new.storage_mb_limit := old.storage_mb_limit;
    new.member_limit := old.member_limit;
  end if;
  return new;
end $$;

-- New sites start on FREE for 30 days (today included).
create or replace function public.create_site(p_handle text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; today date := (now() at time zone 'Asia/Seoul')::date; days int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select coalesce(trial_days, 30) into days from public.plans where code = 'free';
  insert into public.sites (handle, name, created_by, plan, active_from, active_until, service_started_on)
  values (lower(trim(p_handle)), coalesce(trim(p_name), ''), auth.uid(), 'free', today, today + coalesce(days, 30) - 1, today)
  returning id into sid;
  insert into public.site_members (site_id, user_id, role) values (sid, auth.uid(), 'admin');
  insert into public.profiles (user_id, active_site_id) values (auth.uid(), sid)
    on conflict (user_id) do update set active_site_id = excluded.active_site_id;
  return sid;
end $$;

-- 3. Image sizes for the storage limit -----------------------------------------------------
alter table public.media add column if not exists bytes bigint not null default 0;
update public.media m set bytes = coalesce((o.metadata ->> 'size')::bigint, 0)
  from storage.objects o
 where m.bytes = 0 and m.path <> '' and o.bucket_id = 'newsletter-images' and o.name = m.path;

-- 4. Usage -----------------------------------------------------------------------------
-- The limit that applies to a site for one kind: ai, newsletter, subscribers, storage (bytes), members.
create or replace function public.site_limit(p_site uuid, p_kind text)
returns bigint language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'ai' then coalesce(s.ai_token_limit, p.ai_token_limit)
    when 'newsletter' then coalesce(s.newsletter_limit, p.newsletter_limit)
    when 'subscribers' then coalesce(s.subscriber_limit, p.subscriber_limit)
    when 'storage' then coalesce(s.storage_mb_limit, p.storage_mb_limit) * 1048576
    when 'members' then coalesce(s.member_limit, p.member_limit)
  end
  from public.sites s left join public.plans p on p.code = s.plan
  where s.id = p_site;
$$;

create or replace function public.site_used(p_site uuid, p_kind text)
returns bigint language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'ai' then (select coalesce(sum(amount), 0) from public.usage_events
                     where site_id = p_site and kind in ('text', 'image') and created_at >= public.month_start_kst())
    when 'newsletter' then (select coalesce(sum(amount), 0) from public.usage_events
                     where site_id = p_site and kind = 'newsletter' and created_at >= public.month_start_kst())
    when 'subscribers' then (select count(*) from public.recipients where site_id = p_site and status = 'subscribed')
    when 'storage' then (select coalesce(sum(bytes), 0) from public.media where site_id = p_site)
    when 'members' then (select count(*) from public.site_members where site_id = p_site)
                      + (select count(*) from public.site_invites where site_id = p_site)
  end::bigint;
$$;
revoke all on function public.site_limit(uuid, text) from public, anon;
revoke all on function public.site_used(uuid, text) from public, anon;

-- This month's usage and limits of a site (members and super admins).
create or replace function public.site_usage(p_site uuid)
returns table (kind text, used bigint, limit_value bigint)
language sql stable security definer set search_path = public as $$
  select k.kind, public.site_used(p_site, k.kind), public.site_limit(p_site, k.kind)
  from (values (1, 'ai'), (2, 'newsletter'), (3, 'subscribers'), (4, 'storage'), (5, 'members')) as k(n, kind)
  where (public.is_site_member(p_site) or public.is_super_admin())
    and exists (select 1 from public.sites where id = p_site)
  order by k.n;
$$;
grant execute on function public.site_usage(uuid) to authenticated;

-- Records AI (text/image) or newsletter usage for the caller's working site.
-- Crossing 90% of a monthly limit notifies every member once a month.
create or replace function public.record_usage(p_kind text, p_amount bigint)
returns void language plpgsql security definer set search_path = public as $$
declare sid uuid := public.current_site_id(); bucket text; lim bigint; before_sum bigint; label text;
begin
  if sid is null or p_amount is null or p_amount <= 0 then return; end if;
  if p_kind not in ('newsletter', 'text', 'image') then raise exception 'bad kind'; end if;
  bucket := case when p_kind = 'newsletter' then 'newsletter' else 'ai' end;
  lim := public.site_limit(sid, bucket);
  before_sum := public.site_used(sid, bucket);
  insert into public.usage_events (site_id, user_id, kind, amount) values (sid, auth.uid(), p_kind, p_amount);
  if lim is not null and lim > 0 and before_sum < lim * 0.9 and before_sum + p_amount >= lim * 0.9 then
    label := case bucket when 'newsletter' then '뉴스레터 발송 건수' else 'AI 사용량' end;
    insert into public.notifications (user_id, site_id, kind, title, body)
    select m.user_id, sid, 'usage_90',
           label || '이 이번 달 한도의 90%를 넘었어요',
           '사용 ' || to_char(before_sum + p_amount, 'FM999,999,999,999') || ' / 한도 ' || to_char(lim, 'FM999,999,999,999') || ' · 대시보드에서 이용 한도 늘리기를 요청할 수 있어요'
    from public.site_members m where m.site_id = sid;
  end if;
end $$;
revoke all on function public.record_usage(text, bigint) from public, anon;
grant execute on function public.record_usage(text, bigint) to authenticated;

-- 5. Requests: limits, and renewing or changing the plan ------------------------------------
create or replace function public.request_limit_increase(p_kinds text[], p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid := public.current_site_id(); rid uuid;
begin
  if sid is null then raise exception 'no site'; end if;
  if exists (select 1 from public.limit_requests where site_id = sid and status = 'pending' and created_at > now() - interval '12 hours') then
    raise exception 'already requested' using errcode = 'P0004';
  end if;
  insert into public.limit_requests (site_id, user_id, kinds, message)
  values (sid, auth.uid(),
          (select array_agg(k) from unnest(p_kinds) k
            where k in ('newsletter', 'text', 'image', 'ai', 'subscribers', 'storage', 'members', 'renewal', 'plan_change')),
          left(coalesce(p_message, ''), 1000))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.request_limit_increase(text[], text) from public, anon;
grant execute on function public.request_limit_increase(text[], text) to authenticated;

commit;
