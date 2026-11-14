-- LEADstation: super admins (platform operators), site activation and period, account suspension, offline payments.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. (0006, 0007 을 먼저 실행해야 해요.)
-- 실행 후 맨 아래 안내대로 슈퍼 관리자 계정을 한 번 지정하세요.

begin;

-- 1. Super admins ----------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "super admins read admins" on public.platform_admins;
create policy "super admins read admins" on public.platform_admins for select to authenticated using (public.is_super_admin());

-- 2. Site status, active period and service start -------------------------------------
alter table public.sites add column if not exists status text not null default 'active' check (status in ('active', 'inactive'));
alter table public.sites add column if not exists active_from date;
alter table public.sites add column if not exists active_until date;
alter table public.sites add column if not exists service_started_on date;
alter table public.sites add column if not exists admin_memo text not null default '';
update public.sites set service_started_on = created_at::date where service_started_on is null;

-- A site is usable when it is active and today is inside its period (empty dates mean no limit).
create or replace function public.site_is_live(p_site uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sites s where s.id = p_site and s.status = 'active'
      and (s.active_from is null or s.active_from <= (now() at time zone 'Asia/Seoul')::date)
      and (s.active_until is null or s.active_until >= (now() at time zone 'Asia/Seoul')::date)
  );
$$;
grant execute on function public.site_is_live(uuid) to anon, authenticated;

-- 3. Account suspension ---------------------------------------------------------------
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_reason text not null default '';

-- Users may edit their own profile, but not lift their own suspension.
create or replace function public.guard_profile_suspension()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() and auth.uid() is not null then
    new.suspended_at := old.suspended_at;
    new.suspended_reason := old.suspended_reason;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_suspension on public.profiles;
create trigger profiles_guard_suspension before update on public.profiles for each row execute function public.guard_profile_suspension();

-- The working site is only available to a member who is not suspended, on a site that is live.
create or replace function public.current_site_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.active_site_id from public.profiles p
  where p.user_id = auth.uid()
    and p.suspended_at is null
    and exists (select 1 from public.site_members m where m.site_id = p.active_site_id and m.user_id = auth.uid())
    and public.site_is_live(p.active_site_id);
$$;

-- Public pages and blog posts disappear while their site is off.
drop policy if exists "public reads published pages" on public.pages;
create policy "public reads published pages" on public.pages for select to anon, authenticated
  using (status = 'published' and public.site_is_live(site_id));
drop policy if exists "public reads published articles" on public.articles;
create policy "public reads published articles" on public.articles for select to anon, authenticated
  using (status = 'published' and public.site_is_live(site_id));
drop policy if exists "public submits leads to published pages" on public.leads;
create policy "public submits leads to published pages" on public.leads for insert to anon, authenticated
  with check (exists (select 1 from public.pages p where p.id = page_id and p.status = 'published' and public.site_is_live(p.site_id)));

-- Super admins manage every site and can read members, profiles and activity.
drop policy if exists "super admins update sites" on public.sites;
create policy "super admins update sites" on public.sites for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "super admins read members" on public.site_members;
create policy "super admins read members" on public.site_members for select to authenticated using (public.is_super_admin());
drop policy if exists "super admins read profiles" on public.profiles;
create policy "super admins read profiles" on public.profiles for select to authenticated using (public.is_super_admin());
drop policy if exists "super admins update profiles" on public.profiles;
create policy "super admins update profiles" on public.profiles for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "super admins read activity" on public.activity_logs;
create policy "super admins read activity" on public.activity_logs for select to authenticated using (public.is_super_admin());

-- Site admins may not change status or period of their own site.
create or replace function public.guard_site_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() and auth.uid() is not null then
    new.status := old.status;
    new.active_from := old.active_from;
    new.active_until := old.active_until;
    new.service_started_on := old.service_started_on;
    new.admin_memo := old.admin_memo;
  end if;
  return new;
end $$;
drop trigger if exists sites_guard_admin_fields on public.sites;
create trigger sites_guard_admin_fields before update on public.sites for each row execute function public.guard_site_admin_fields();

-- Keep the operator memo private: columns readable by everyone exclude admin_memo.
revoke select on public.sites from anon, authenticated;
grant select (id, handle, name, created_by, created_at, status, active_from, active_until, service_started_on) on public.sites to anon, authenticated;
grant update (handle, name, status, active_from, active_until, service_started_on, admin_memo) on public.sites to authenticated;

create or replace function public.admin_site_memo(p_site uuid)
returns text language sql stable security definer set search_path = public as $$
  select admin_memo from public.sites where id = p_site and public.is_super_admin();
$$;
grant execute on function public.admin_site_memo(uuid) to authenticated;

-- 4. Offline payments ------------------------------------------------------------------
create table if not exists public.site_payments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  paid_on date not null,
  amount bigint not null check (amount >= 0),
  method text not null default 'transfer' check (method in ('transfer', 'card', 'cash', 'other')),
  period_from date,
  period_to date,
  payer text not null default '',
  memo text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists site_payments_site_idx on public.site_payments (site_id, paid_on desc);
create index if not exists site_payments_date_idx on public.site_payments (paid_on desc);
alter table public.site_payments enable row level security;
drop policy if exists "super admins manage payments" on public.site_payments;
create policy "super admins manage payments" on public.site_payments for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "site admins read own payments" on public.site_payments;
create policy "site admins read own payments" on public.site_payments for select to authenticated using (public.is_site_admin(site_id));

-- 5. Lists for the admin screens (super admins only) ---------------------------------
create or replace function public.admin_user_list(p_query text default '', p_status text default 'all', p_limit int default 50, p_offset int default 0)
returns table (user_id uuid, email text, full_name text, phone text, company text, created_at timestamptz, last_sign_in_at timestamptz,
               suspended_at timestamptz, sites text, total bigint)
language plpgsql stable security definer set search_path = public, auth as $$
declare q text := '%' || lower(coalesce(trim(p_query), '')) || '%';
begin
  if not public.is_super_admin() then raise exception 'super admins only'; end if;
  return query
  with base as (
    select u.id, u.email::text as email, coalesce(p.full_name, '') as full_name, coalesce(p.phone, '') as phone,
           coalesce(p.company, '') as company, u.created_at, u.last_sign_in_at, p.suspended_at,
           coalesce((select string_agg(s.handle || case when m.role = 'admin' then '(관리자)' else '' end, ', ' order by s.handle)
                     from public.site_members m join public.sites s on s.id = m.site_id where m.user_id = u.id), '') as sites
    from auth.users u left join public.profiles p on p.user_id = u.id
  ), filtered as (
    select * from base b
    where (lower(b.email) like q or lower(b.full_name) like q or lower(b.company) like q or b.phone like q or lower(b.sites) like q)
      and (p_status = 'all' or (p_status = 'suspended' and b.suspended_at is not null) or (p_status = 'normal' and b.suspended_at is null))
  )
  select f.id, f.email, f.full_name, f.phone, f.company, f.created_at, f.last_sign_in_at, f.suspended_at, f.sites,
         count(*) over () as total
  from filtered f order by f.created_at desc limit p_limit offset p_offset;
end $$;

create or replace function public.admin_user_detail(p_user uuid)
returns table (user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz,
               full_name text, phone text, company text, suspended_at timestamptz, suspended_reason text, is_super_admin boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_super_admin() then raise exception 'super admins only'; end if;
  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at,
         coalesce(p.full_name, ''), coalesce(p.phone, ''), coalesce(p.company, ''), p.suspended_at, coalesce(p.suspended_reason, ''),
         exists (select 1 from public.platform_admins a where a.user_id = u.id)
  from auth.users u left join public.profiles p on p.user_id = u.id
  where u.id = p_user;
end $$;

create or replace function public.admin_site_members(p_site uuid)
returns table (user_id uuid, email text, full_name text, role text, suspended_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_super_admin() then raise exception 'super admins only'; end if;
  return query
  select m.user_id, u.email::text, coalesce(p.full_name, ''), m.role, p.suspended_at
  from public.site_members m join auth.users u on u.id = m.user_id left join public.profiles p on p.user_id = m.user_id
  where m.site_id = p_site order by m.role, m.created_at;
end $$;

-- Suspends (p_suspend = true) or restores an account.
create or replace function public.admin_set_suspended(p_user uuid, p_suspend boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'super admins only'; end if;
  if p_user = auth.uid() then raise exception 'cannot suspend yourself'; end if;
  insert into public.profiles (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.profiles
     set suspended_at = case when p_suspend then now() else null end,
         suspended_reason = case when p_suspend then left(coalesce(p_reason, ''), 500) else '' end
   where user_id = p_user;
end $$;

revoke all on function public.admin_user_list(text, text, int, int) from public, anon;
revoke all on function public.admin_user_detail(uuid) from public, anon;
revoke all on function public.admin_site_members(uuid) from public, anon;
revoke all on function public.admin_set_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_user_list(text, text, int, int) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_site_members(uuid) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

commit;

-- 슈퍼 관리자 지정 (한 번만, 이메일을 바꿔서 실행):
-- insert into public.platform_admins (user_id) select id from auth.users where email = '내 이메일' on conflict do nothing;
