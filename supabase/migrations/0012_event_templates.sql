-- Event game templates made by super admins and offered to every site once published.

begin;

create table if not exists public.event_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  prompt text not null default '' check (char_length(prompt) <= 4000),
  css text not null default '',
  html text not null default '',
  js text not null default '',
  config jsonb not null default '{}'::jsonb,
  config_guide text not null default '',
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  error text,
  -- Set while AI revises a ready template (the current game stays usable meanwhile).
  revising_since timestamptz,
  is_public boolean not null default false,
  sort_order int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists event_templates_touch_updated_at on public.event_templates;
create trigger event_templates_touch_updated_at
before update on public.event_templates
for each row execute function public.touch_updated_at();

alter table public.event_templates enable row level security;

drop policy if exists "super admins manage event templates" on public.event_templates;
create policy "super admins manage event templates" on public.event_templates for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "users read public event templates" on public.event_templates;
create policy "users read public event templates" on public.event_templates for select to authenticated
  using (is_public and status = 'ready');

commit;
