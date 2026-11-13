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
