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
