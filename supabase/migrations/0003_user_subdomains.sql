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
