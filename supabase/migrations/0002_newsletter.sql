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
