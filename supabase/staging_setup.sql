-- LEADstation staging DB: 0001~0008 migrations in one file. Run once on the new staging Supabase project.

-- ===== 0001_lead_collector.sql =====
-- Lead Collector: promotion pages and the leads they collect.

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published')),
  brief jsonb not null default '{}'::jsonb,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pages_user_id_idx on public.pages (user_id, created_at desc);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (char_length(phone) <= 50),
  message text check (char_length(message) <= 2000),
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create index leads_page_id_idx on public.leads (page_id, created_at desc);

-- Keep updated_at current.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pages_touch_updated_at
before update on public.pages
for each row execute function public.touch_updated_at();

-- Row level security
alter table public.pages enable row level security;
alter table public.leads enable row level security;

-- Owners manage their own pages.
create policy "owners read own pages" on public.pages
  for select to authenticated using (user_id = auth.uid());
create policy "owners insert own pages" on public.pages
  for insert to authenticated with check (user_id = auth.uid());
create policy "owners update own pages" on public.pages
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners delete own pages" on public.pages
  for delete to authenticated using (user_id = auth.uid());

-- Anyone can view a published page.
create policy "public reads published pages" on public.pages
  for select to anon, authenticated using (status = 'published');

-- Anyone can submit a lead to a published page.
create policy "public submits leads to published pages" on public.leads
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.pages p where p.id = page_id and p.status = 'published')
  );

-- Owners read and delete leads of their pages.
create policy "owners read own leads" on public.leads
  for select to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.user_id = auth.uid()));
create policy "owners delete own leads" on public.leads
  for delete to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.user_id = auth.uid()));

-- ===== 0002_newsletter.sql =====
-- AI Newsletter: sender settings, recipients, groups, newsletters, campaigns, send logs.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요.

create table public.newsletter_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  from_name text not null default '',
  reply_to text not null default '',
  footer_text text not null default '',
  logo_url text not null default '',
  accent_color text not null default '#2f5d8a',
  brand_context text not null default '',
  updated_at timestamptz not null default now()
);

create table public.recipient_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 200),
  name text not null default '',
  phone text not null default '',
  company text not null default '',
  memo text not null default '',
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source text not null default 'manual' check (source in ('manual', 'import', 'lead')),
  unsub_token uuid not null default gen_random_uuid() unique,
  unsubscribed_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);
create index recipients_user_idx on public.recipients (user_id, created_at desc);

create table public.recipient_group_members (
  group_id uuid not null references public.recipient_groups (id) on delete cascade,
  recipient_id uuid not null references public.recipients (id) on delete cascade,
  primary key (group_id, recipient_id)
);
create index recipient_group_members_recipient_idx on public.recipient_group_members (recipient_id);

create table public.newsletters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  subject text not null default '',
  preheader text not null default '',
  topic text not null default '',
  prompt text not null default '',
  tone text not null default 'friendly',
  template text not null default 'card',
  greeting boolean not null default false,
  blocks jsonb not null default '[]'::jsonb,
  previous_blocks jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index newsletters_user_idx on public.newsletters (user_id, updated_at desc);
create trigger newsletters_touch_updated_at
before update on public.newsletters
for each row execute function public.touch_updated_at();

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  newsletter_id uuid not null references public.newsletters (id) on delete cascade,
  type text not null default 'initial' check (type in ('initial', 'resend')),
  subject text not null,
  html text not null,
  from_name text not null default '',
  reply_to text not null default '',
  audience jsonb not null default '{}'::jsonb,
  total int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  status text not null default 'queued' check (status in ('scheduled', 'queued', 'sending', 'done', 'canceled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index campaigns_newsletter_idx on public.campaigns (newsletter_id, created_at desc);
create index campaigns_due_idx on public.campaigns (status, scheduled_at);

create table public.send_logs (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid references public.recipients (id) on delete set null,
  email text not null,
  name text not null default '',
  unsub_token uuid,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error text not null default '',
  sent_at timestamptz
);
create index send_logs_campaign_status_idx on public.send_logs (campaign_id, status);

-- Row level security: every table is private to its owner.
alter table public.newsletter_settings enable row level security;
alter table public.recipient_groups enable row level security;
alter table public.recipients enable row level security;
alter table public.recipient_group_members enable row level security;
alter table public.newsletters enable row level security;
alter table public.campaigns enable row level security;
alter table public.send_logs enable row level security;

create policy "own settings" on public.newsletter_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own groups" on public.recipient_groups
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own recipients" on public.recipients
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own group members" on public.recipient_group_members
  for all to authenticated
  using (exists (select 1 from public.recipient_groups g where g.id = group_id and g.user_id = auth.uid()))
  with check (
    exists (select 1 from public.recipient_groups g where g.id = group_id and g.user_id = auth.uid())
    and exists (select 1 from public.recipients r where r.id = recipient_id and r.user_id = auth.uid())
  );
create policy "own newsletters" on public.newsletters
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own campaigns" on public.campaigns
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own send logs" on public.send_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public unsubscribe: anyone holding the token from an email can see and change only that one address.
create or replace function public.unsubscribe_info(p_token uuid)
returns table (email text, status text, sender text)
language sql security definer set search_path = public stable as $$
  select r.email, r.status, coalesce(nullif(s.from_name, ''), 'LEADstation')
  from public.recipients r
  left join public.newsletter_settings s on s.user_id = r.user_id
  where r.unsub_token = p_token;
$$;

create or replace function public.set_subscription(p_token uuid, p_subscribed boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.recipients
     set status = case when p_subscribed then 'subscribed' else 'unsubscribed' end,
         unsubscribed_at = case when p_subscribed then null else now() end
   where unsub_token = p_token;
  return found;
end;
$$;

revoke all on function public.unsubscribe_info(uuid) from public;
revoke all on function public.set_subscription(uuid, boolean) from public;
grant execute on function public.unsubscribe_info(uuid) to anon, authenticated;
grant execute on function public.set_subscription(uuid, boolean) to anon, authenticated;

-- Image uploads for newsletters (public read, owner-only write under their own folder).
insert into storage.buckets (id, name, public)
values ('newsletter-images', 'newsletter-images', true)
on conflict (id) do nothing;

create policy "newsletter images upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'newsletter-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "newsletter images delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'newsletter-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== 0003_user_subdomains.sql =====
-- User handles for subdomain addresses (handle.leadstation.kr) and per-user page addresses.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique
    check (handle ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$')
    check (handle not in ('www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp', 'dashboard', 'login', 'help',
                          'support', 'blog', 'docs', 'status', 'static', 'assets', 'cdn', 'dev', 'test', 'leadstation')),
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "anyone reads profiles" on public.profiles for select to anon, authenticated using (true);
create policy "owner inserts profile" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "owner updates profile" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Page addresses are unique per user instead of across the whole site.
alter table public.pages drop constraint if exists pages_slug_key;
alter table public.pages add constraint pages_user_slug_key unique (user_id, slug);
alter table public.pages add constraint pages_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$') not valid;
create index if not exists pages_slug_idx on public.pages (slug);

-- ===== 0004_ai_writer.sql =====
-- LEADstation: Neo AI Writer (blog posts on handle.leadstation.kr/blog/slug)

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  status text not null default 'draft' check (status in ('draft', 'published')),
  slug text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$'),
  title text not null default '',
  keyword text not null default '',
  brief jsonb not null default '{}'::jsonb,
  seo_title text not null default '',
  meta_description text not null default '',
  tags text[] not null default '{}',
  header_image jsonb not null default '{}'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);
create index if not exists articles_user_idx on public.articles (user_id, created_at desc);

alter table public.articles enable row level security;

drop policy if exists "articles public read" on public.articles;
create policy "articles public read" on public.articles
  for select using (status = 'published');
drop policy if exists "articles owner all" on public.articles;
create policy "articles owner all" on public.articles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.writer_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  brand_voice text not null default '',
  banned_words text not null default '',
  tone text not null default 'friendly',
  length text not null default 'medium',
  language text not null default 'ko',
  updated_at timestamptz not null default now()
);
alter table public.writer_settings enable row level security;
drop policy if exists "writer settings owner" on public.writer_settings;
create policy "writer settings owner" on public.writer_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== 0005_media_library.sql =====
-- LEADstation: image library shared by every tool (AI images and uploads)

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  url text not null,
  path text not null default '',
  source text not null default 'ai' check (source in ('ai', 'upload')),
  prompt text not null default '',
  style text not null default '',
  ratio text not null default '',
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index if not exists media_user_idx on public.media (user_id, created_at desc);

alter table public.media enable row level security;
drop policy if exists "media owner all" on public.media;
create policy "media owner all" on public.media
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== 0006_sites_and_members.sql =====
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

-- ===== 0007_dashboard_activity.sql =====
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

-- ===== 0008_super_admin.sql =====
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

-- ===== 0009_usage_limits.sql =====
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
