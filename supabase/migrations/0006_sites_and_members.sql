-- LEADstation: sites shared by several users (admin / member) and personal profiles.
-- Every tool's data now belongs to a site (site_id) instead of a single user.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. 기존 데이터는 각 사용자의 사이트로 옮겨져요.

begin;

-- 1. Sites and members -------------------------------------------------------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique
    check (handle ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$')
    check (handle not in ('www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp', 'dashboard', 'login', 'help',
                          'support', 'blog', 'docs', 'status', 'static', 'assets', 'cdn', 'dev', 'test', 'leadstation')),
  name text not null default '' check (char_length(name) <= 100),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_members (
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);
create index if not exists site_members_user_idx on public.site_members (user_id);

-- Invitations for people who have not signed up yet (joined automatically at sign-up).
create table if not exists public.site_invites (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (site_id, email)
);

-- 2. Personal profile ---------------------------------------------------------
alter table public.profiles add column if not exists full_name text not null default '' check (char_length(full_name) <= 50);
alter table public.profiles add column if not exists phone text not null default '' check (char_length(phone) <= 30);
alter table public.profiles add column if not exists company text not null default '' check (char_length(company) <= 100);
alter table public.profiles add column if not exists active_site_id uuid references public.sites (id) on delete set null;

-- Existing users: their address becomes a site they administer.
do $$
declare r record; sid uuid;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'handle') then
    for r in execute 'select user_id, handle, display_name from public.profiles where handle is not null' loop
      select id into sid from public.sites where handle = r.handle;
      if sid is null then
        insert into public.sites (handle, name, created_by) values (r.handle, coalesce(r.display_name, ''), r.user_id) returning id into sid;
      end if;
      insert into public.site_members (site_id, user_id, role) values (sid, r.user_id, 'admin') on conflict do nothing;
      update public.profiles set active_site_id = sid, company = case when company = '' then coalesce(r.display_name, '') else company end
       where user_id = r.user_id;
    end loop;
    alter table public.profiles drop column handle;
    alter table public.profiles drop column if exists display_name;
  end if;
end $$;

-- Users without a profile row who already have data: give them a site so nothing is lost.
-- (Their site address is a temporary one; they can change it in My Profile.)
do $$
declare u uuid; sid uuid;
begin
  for u in
    select distinct user_id from (
      select user_id from public.pages union select user_id from public.newsletters union select user_id from public.recipients
      union select user_id from public.recipient_groups union select user_id from public.articles union select user_id from public.media
      union select user_id from public.newsletter_settings union select user_id from public.writer_settings
    ) x where user_id not in (select user_id from public.site_members)
  loop
    insert into public.sites (handle, name, created_by) values ('site-' || substr(replace(u::text, '-', ''), 1, 10), '', u) returning id into sid;
    insert into public.site_members (site_id, user_id, role) values (sid, u, 'admin');
    insert into public.profiles (user_id, active_site_id) values (u, sid)
      on conflict (user_id) do update set active_site_id = excluded.active_site_id;
  end loop;
end $$;

-- 3. Helpers used by row level security --------------------------------------
create or replace function public.current_site_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.active_site_id from public.profiles p
  where p.user_id = auth.uid()
    and exists (select 1 from public.site_members m where m.site_id = p.active_site_id and m.user_id = auth.uid());
$$;

create or replace function public.is_site_member(p_site uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_members where site_id = p_site and user_id = auth.uid());
$$;

create or replace function public.is_site_admin(p_site uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_members where site_id = p_site and user_id = auth.uid() and role = 'admin');
$$;

-- 4. site_id on every table ---------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pages', 'newsletter_settings', 'recipient_groups', 'recipients', 'newsletters', 'campaigns',
                           'send_logs', 'articles', 'writer_settings', 'media'] loop
    execute format('alter table public.%I add column if not exists site_id uuid references public.sites (id) on delete cascade', t);
    execute format('update public.%I x set site_id = p.active_site_id from public.profiles p where x.site_id is null and p.user_id = x.user_id', t);
    execute format('delete from public.%I where site_id is null', t);
    execute format('alter table public.%I alter column site_id set default public.current_site_id()', t);
    execute format('alter table public.%I alter column site_id set not null', t);
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
    execute format('create index if not exists %I on public.%I (site_id)', t || '_site_idx', t);
  end loop;
end $$;

-- Uniqueness per site instead of per user.
alter table public.pages drop constraint if exists pages_user_slug_key;
alter table public.pages drop constraint if exists pages_site_slug_key;
alter table public.pages add constraint pages_site_slug_key unique (site_id, slug);
alter table public.articles drop constraint if exists articles_user_id_slug_key;
alter table public.articles drop constraint if exists articles_site_slug_key;
alter table public.articles add constraint articles_site_slug_key unique (site_id, slug);
alter table public.recipients drop constraint if exists recipients_user_id_email_key;
alter table public.recipients drop constraint if exists recipients_site_email_key;
alter table public.recipients add constraint recipients_site_email_key unique (site_id, email);
alter table public.recipient_groups drop constraint if exists recipient_groups_user_id_name_key;
alter table public.recipient_groups drop constraint if exists recipient_groups_site_name_key;
alter table public.recipient_groups add constraint recipient_groups_site_name_key unique (site_id, name);
-- One settings row per site.
delete from public.newsletter_settings a using public.newsletter_settings b
  where a.site_id = b.site_id and a.ctid < b.ctid;
alter table public.newsletter_settings drop constraint if exists newsletter_settings_pkey;
alter table public.newsletter_settings add primary key (site_id);
delete from public.writer_settings a using public.writer_settings b
  where a.site_id = b.site_id and a.ctid < b.ctid;
alter table public.writer_settings drop constraint if exists writer_settings_pkey;
alter table public.writer_settings add primary key (site_id);

-- 5. Row level security: members of the active site share its data -----------
do $$
declare r record; t text;
begin
  foreach t in array array['pages', 'leads', 'newsletter_settings', 'recipient_groups', 'recipients', 'recipient_group_members',
                           'newsletters', 'campaigns', 'send_logs', 'articles', 'writer_settings', 'media'] loop
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;
  end loop;
  foreach t in array array['pages', 'newsletter_settings', 'recipient_groups', 'recipients', 'newsletters', 'campaigns',
                           'send_logs', 'articles', 'writer_settings', 'media'] loop
    execute format('create policy "site members" on public.%I for all to authenticated
                      using (site_id = (select public.current_site_id()))
                      with check (site_id = (select public.current_site_id()))', t);
  end loop;
end $$;

create policy "public reads published pages" on public.pages for select to anon, authenticated using (status = 'published');
create policy "public reads published articles" on public.articles for select to anon, authenticated using (status = 'published');

create policy "public submits leads to published pages" on public.leads for insert to anon, authenticated
  with check (exists (select 1 from public.pages p where p.id = page_id and p.status = 'published'));
create policy "site members read leads" on public.leads for select to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.site_id = (select public.current_site_id())));
create policy "site members delete leads" on public.leads for delete to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.site_id = (select public.current_site_id())));

create policy "site members" on public.recipient_group_members for all to authenticated
  using (exists (select 1 from public.recipient_groups g where g.id = group_id and g.site_id = (select public.current_site_id())))
  with check (
    exists (select 1 from public.recipient_groups g where g.id = group_id and g.site_id = (select public.current_site_id()))
    and exists (select 1 from public.recipients r where r.id = recipient_id and r.site_id = (select public.current_site_id()))
  );

alter table public.sites enable row level security;
alter table public.site_members enable row level security;
alter table public.site_invites enable row level security;
drop policy if exists "anyone reads sites" on public.sites;
create policy "anyone reads sites" on public.sites for select to anon, authenticated using (true);
drop policy if exists "admins update sites" on public.sites;
create policy "admins update sites" on public.sites for update to authenticated
  using (public.is_site_admin(id)) with check (public.is_site_admin(id));
drop policy if exists "members read members" on public.site_members;
create policy "members read members" on public.site_members for select to authenticated using (public.is_site_member(site_id));
drop policy if exists "admins manage members" on public.site_members;
create policy "admins manage members" on public.site_members for update to authenticated
  using (public.is_site_admin(site_id)) with check (public.is_site_admin(site_id));
drop policy if exists "admins remove members" on public.site_members;
create policy "admins remove members" on public.site_members for delete to authenticated
  using (public.is_site_admin(site_id) or user_id = auth.uid());
drop policy if exists "admins manage invites" on public.site_invites;
create policy "admins manage invites" on public.site_invites for all to authenticated
  using (public.is_site_admin(site_id)) with check (public.is_site_admin(site_id));

-- Profiles: people read and change only their own (public pages now use sites).
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;
create policy "own profile" on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members read each other" on public.profiles for select to authenticated
  using (exists (select 1 from public.site_members a join public.site_members b on a.site_id = b.site_id
                 where a.user_id = auth.uid() and b.user_id = profiles.user_id));

-- 6. Functions for creating sites and managing members -----------------------
create or replace function public.create_site(p_handle text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.sites (handle, name, created_by) values (lower(trim(p_handle)), coalesce(trim(p_name), ''), auth.uid()) returning id into sid;
  insert into public.site_members (site_id, user_id, role) values (sid, auth.uid(), 'admin');
  insert into public.profiles (user_id, active_site_id) values (auth.uid(), sid)
    on conflict (user_id) do update set active_site_id = excluded.active_site_id;
  return sid;
end $$;

-- Adds a member by email. Existing account: joins now ('added'). Otherwise: invite kept until they sign up ('invited').
create or replace function public.add_site_member(p_site uuid, p_email text, p_role text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; e text := lower(trim(p_email));
begin
  if not public.is_site_admin(p_site) then raise exception 'only admins can add members'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad role'; end if;
  select id into uid from auth.users where lower(email) = e limit 1;
  if uid is not null then
    insert into public.site_members (site_id, user_id, role) values (p_site, uid, p_role)
      on conflict (site_id, user_id) do update set role = excluded.role;
    insert into public.profiles (user_id, active_site_id) values (uid, p_site) on conflict (user_id) do nothing;
    update public.profiles set active_site_id = p_site where user_id = uid and active_site_id is null;
    return 'added';
  end if;
  insert into public.site_invites (site_id, email, role, invited_by) values (p_site, e, p_role, auth.uid())
    on conflict (site_id, email) do update set role = excluded.role;
  return 'invited';
end $$;

-- Joins the sites the signed-in user was invited to. Returns how many.
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
    n := n + 1;
  end loop;
  delete from public.site_invites where email = e;
  return n;
end $$;

-- Members of a site with their email and name (members only).
create or replace function public.site_member_list(p_site uuid)
returns table (user_id uuid, email text, full_name text, phone text, role text, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, u.email::text, coalesce(p.full_name, ''), coalesce(p.phone, ''), m.role, m.created_at
  from public.site_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.site_id = p_site and public.is_site_member(p_site)
  order by m.role, m.created_at;
$$;

revoke all on function public.create_site(text, text) from public, anon;
revoke all on function public.add_site_member(uuid, text, text) from public, anon;
revoke all on function public.accept_site_invites() from public, anon;
revoke all on function public.site_member_list(uuid) from public, anon;
grant execute on function public.create_site(text, text) to authenticated;
grant execute on function public.add_site_member(uuid, text, text) to authenticated;
grant execute on function public.accept_site_invites() to authenticated;
grant execute on function public.site_member_list(uuid) to authenticated;
grant execute on function public.current_site_id() to anon, authenticated;

-- 7. Unsubscribe page reads the sender name from the site's settings.
create or replace function public.unsubscribe_info(p_token uuid)
returns table (email text, status text, sender text)
language sql security definer set search_path = public stable as $$
  select r.email, r.status, coalesce(nullif(s.from_name, ''), 'LEADstation')
  from public.recipients r
  left join public.newsletter_settings s on s.site_id = r.site_id
  where r.unsub_token = p_token;
$$;

commit;
