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
