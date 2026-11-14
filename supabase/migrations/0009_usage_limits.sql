-- LEADstation: per-site monthly usage limits (newsletter emails, AI text tokens, AI image tokens),
-- usage records, 90% notifications and requests to raise a limit.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. (0008 다음)

begin;

-- 1. Limits on each site (empty = no limit). Counted per calendar month (Korea time).
alter table public.sites add column if not exists newsletter_limit bigint check (newsletter_limit >= 0);
alter table public.sites add column if not exists text_token_limit bigint check (text_token_limit >= 0);
alter table public.sites add column if not exists image_token_limit bigint check (image_token_limit >= 0);
grant select (newsletter_limit, text_token_limit, image_token_limit) on public.sites to anon, authenticated;
grant update (newsletter_limit, text_token_limit, image_token_limit) on public.sites to authenticated;

-- Only super admins change limits.
create or replace function public.guard_site_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() and auth.uid() is not null then
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

-- 2. Usage records ---------------------------------------------------------------------
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('newsletter', 'text', 'image')),
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists usage_events_site_idx on public.usage_events (site_id, kind, created_at);
alter table public.usage_events enable row level security;
drop policy if exists "members read usage" on public.usage_events;
create policy "members read usage" on public.usage_events for select to authenticated
  using (public.is_site_member(site_id) or public.is_super_admin());

create or replace function public.month_start_kst()
returns timestamptz language sql stable as $$
  select date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;

-- This month's usage and limits of a site (members and super admins).
create or replace function public.site_usage(p_site uuid)
returns table (kind text, used bigint, limit_value bigint)
language sql stable security definer set search_path = public as $$
  select k.kind,
         coalesce((select sum(e.amount) from public.usage_events e
                   where e.site_id = p_site and e.kind = k.kind and e.created_at >= public.month_start_kst()), 0)::bigint,
         case k.kind when 'newsletter' then s.newsletter_limit when 'text' then s.text_token_limit else s.image_token_limit end
  from (values ('newsletter'), ('text'), ('image')) as k(kind)
  join public.sites s on s.id = p_site
  where public.is_site_member(p_site) or public.is_super_admin();
$$;
grant execute on function public.site_usage(uuid) to authenticated;

-- Records usage for the caller's working site. Crossing 90% of a limit notifies every member once a month.
create or replace function public.record_usage(p_kind text, p_amount bigint)
returns void language plpgsql security definer set search_path = public as $$
declare sid uuid := public.current_site_id(); lim bigint; before_sum bigint; label text;
begin
  if sid is null or p_amount is null or p_amount <= 0 then return; end if;
  if p_kind not in ('newsletter', 'text', 'image') then raise exception 'bad kind'; end if;
  select case p_kind when 'newsletter' then newsletter_limit when 'text' then text_token_limit else image_token_limit end
    into lim from public.sites where id = sid;
  select coalesce(sum(amount), 0) into before_sum from public.usage_events
   where site_id = sid and kind = p_kind and created_at >= public.month_start_kst();
  insert into public.usage_events (site_id, user_id, kind, amount) values (sid, auth.uid(), p_kind, p_amount);
  if lim is not null and lim > 0 and before_sum < lim * 0.9 and before_sum + p_amount >= lim * 0.9 then
    label := case p_kind when 'newsletter' then '뉴스레터 발송 건수' when 'text' then 'AI 본문 생성 토큰' else 'AI 이미지 생성 토큰' end;
    insert into public.notifications (user_id, site_id, kind, title, body)
    select m.user_id, sid, 'usage_90',
           label || ' 사용량이 이번 달 한도의 90%를 넘었어요',
           '사용 ' || to_char(before_sum + p_amount, 'FM999,999,999,999') || ' / 한도 ' || to_char(lim, 'FM999,999,999,999') || ' · 대시보드에서 이용 한도 늘리기를 요청할 수 있어요'
    from public.site_members m where m.site_id = sid;
  end if;
end $$;
revoke all on function public.record_usage(text, bigint) from public, anon;
grant execute on function public.record_usage(text, bigint) to authenticated;

-- 3. Requests to raise a limit --------------------------------------------------------
create table if not exists public.limit_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kinds text[] not null,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists limit_requests_status_idx on public.limit_requests (status, created_at desc);
alter table public.limit_requests enable row level security;
drop policy if exists "members read requests" on public.limit_requests;
create policy "members read requests" on public.limit_requests for select to authenticated
  using (public.is_site_member(site_id) or public.is_super_admin());
drop policy if exists "super admins update requests" on public.limit_requests;
create policy "super admins update requests" on public.limit_requests for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Files a request for the caller's working site (at most one open request per site every 12 hours).
create or replace function public.request_limit_increase(p_kinds text[], p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid := public.current_site_id(); rid uuid;
begin
  if sid is null then raise exception 'no site'; end if;
  if exists (select 1 from public.limit_requests where site_id = sid and status = 'pending' and created_at > now() - interval '12 hours') then
    raise exception 'already requested' using errcode = 'P0004';
  end if;
  insert into public.limit_requests (site_id, user_id, kinds, message)
  values (sid, auth.uid(), (select array_agg(k) from unnest(p_kinds) k where k in ('newsletter', 'text', 'image')), left(coalesce(p_message, ''), 1000))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.request_limit_increase(text[], text) from public, anon;
grant execute on function public.request_limit_increase(text[], text) to authenticated;

commit;
