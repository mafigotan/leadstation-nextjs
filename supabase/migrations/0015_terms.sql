-- Terms (개인정보 수집·이용 등) per site, kept as versions.
-- Promotion forms link terms (latest version, or a pinned one); every lead records which version it agreed to.

begin;

-- 1. Tables ---------------------------------------------------------------------
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'privacy' check (kind in ('privacy', 'third_party', 'marketing', 'other')),
  is_default boolean not null default false,
  current_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists terms_site_idx on public.terms (site_id, created_at desc);

-- A published version never changes. Each term has at most one draft (published_at is null).
create table if not exists public.term_versions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete cascade,
  version int not null check (version > 0),
  label text not null check (char_length(label) between 1 and 200),
  body text not null default '' check (char_length(body) <= 20000),
  body_hash text not null default '',
  change_note text not null default '' check (char_length(change_note) <= 300),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (term_id, version)
);
create unique index if not exists term_versions_one_draft on public.term_versions (term_id) where published_at is null;

alter table public.terms drop constraint if exists terms_current_version_fkey;
alter table public.terms add constraint terms_current_version_fkey
  foreign key (current_version_id) references public.term_versions (id) on delete set null;

-- What each lead was shown and whether they agreed (optional terms they skipped are kept as agreed = false).
create table if not exists public.lead_consents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  term_version_id uuid not null references public.term_versions (id) on delete cascade,
  required boolean not null default false,
  agreed boolean not null default false,
  agreed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lead_id, term_version_id)
);
create index if not exists lead_consents_version_idx on public.lead_consents (term_version_id);

-- 2. Version rules ----------------------------------------------------------------
create or replace function public.guard_term_version()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.published_at is not null then
    raise exception 'published term versions cannot change' using errcode = 'P0006';
  end if;
  new.body_hash := encode(sha256(convert_to(new.body, 'UTF8')), 'hex');
  return new;
end $$;
drop trigger if exists term_versions_guard on public.term_versions;
create trigger term_versions_guard before insert or update on public.term_versions
  for each row execute function public.guard_term_version();

-- Publishing a version makes it the term's current version.
create or replace function public.track_term_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.published_at is not null and (tg_op = 'INSERT' or old.published_at is null) then
    update public.terms set current_version_id = new.id, updated_at = now() where id = new.term_id;
  end if;
  return null;
end $$;
drop trigger if exists term_versions_publish on public.term_versions;
create trigger term_versions_publish after insert or update on public.term_versions
  for each row execute function public.track_term_publish();

drop trigger if exists terms_touch_updated_at on public.terms;
create trigger terms_touch_updated_at before update on public.terms
  for each row execute function public.touch_updated_at();

-- 3. Row level security -------------------------------------------------------------
alter table public.terms enable row level security;
alter table public.term_versions enable row level security;
alter table public.lead_consents enable row level security;

drop policy if exists "site members read terms" on public.terms;
create policy "site members read terms" on public.terms for select to authenticated
  using (site_id = (select public.current_site_id()));
drop policy if exists "site members add terms" on public.terms;
create policy "site members add terms" on public.terms for insert to authenticated
  with check (site_id = (select public.current_site_id()));
drop policy if exists "site members change terms" on public.terms;
create policy "site members change terms" on public.terms for update to authenticated
  using (site_id = (select public.current_site_id())) with check (site_id = (select public.current_site_id()));
-- A term can be deleted only while no lead has agreed to it; otherwise it is archived.
create or replace function public.term_has_consents(p_term uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.term_versions v join public.lead_consents c on c.term_version_id = v.id where v.term_id = p_term);
$$;
grant execute on function public.term_has_consents(uuid) to authenticated;
drop policy if exists "site members delete unused terms" on public.terms;
create policy "site members delete unused terms" on public.terms for delete to authenticated
  using (site_id = (select public.current_site_id()) and not public.term_has_consents(id));
drop policy if exists "public reads live terms" on public.terms;
create policy "public reads live terms" on public.terms for select to anon, authenticated
  using (archived_at is null and public.site_is_live(site_id));

drop policy if exists "site members read term versions" on public.term_versions;
create policy "site members read term versions" on public.term_versions for select to authenticated
  using (exists (select 1 from public.terms t where t.id = term_id and t.site_id = (select public.current_site_id())));
drop policy if exists "site members add term versions" on public.term_versions;
create policy "site members add term versions" on public.term_versions for insert to authenticated
  with check (exists (select 1 from public.terms t where t.id = term_id and t.site_id = (select public.current_site_id())));
drop policy if exists "site members change drafts" on public.term_versions;
create policy "site members change drafts" on public.term_versions for update to authenticated
  using (published_at is null and exists (select 1 from public.terms t where t.id = term_id and t.site_id = (select public.current_site_id())))
  with check (exists (select 1 from public.terms t where t.id = term_id and t.site_id = (select public.current_site_id())));
drop policy if exists "site members delete drafts" on public.term_versions;
create policy "site members delete drafts" on public.term_versions for delete to authenticated
  using (published_at is null and exists (select 1 from public.terms t where t.id = term_id and t.site_id = (select public.current_site_id())));
drop policy if exists "public reads published term versions" on public.term_versions;
create policy "public reads published term versions" on public.term_versions for select to anon, authenticated
  using (published_at is not null and exists (select 1 from public.terms t where t.id = term_id and t.archived_at is null and public.site_is_live(t.site_id)));

drop policy if exists "site members read consents" on public.lead_consents;
create policy "site members read consents" on public.lead_consents for select to authenticated
  using (exists (select 1 from public.leads l join public.pages p on p.id = l.page_id
                 where l.id = lead_id and p.site_id = (select public.current_site_id())));

-- 4. Submitting a lead with its consents (one transaction) ---------------------------
-- p_consents: [{ "version_id": uuid, "required": bool, "agreed": bool }]. Versions must be published terms of the page's site.
create or replace function public.submit_lead(p_page uuid, p_lead jsonb, p_consents jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; lid uuid; c jsonb;
begin
  select site_id into sid from public.pages where id = p_page and status = 'published' and public.site_is_live(site_id);
  if sid is null then raise exception 'page is not open' using errcode = 'P0007'; end if;
  insert into public.leads (page_id, name, email, phone, message, address, gender, age, nationality, event, marketing_consent)
  values (
    p_page,
    coalesce(p_lead->>'name', ''), coalesce(p_lead->>'email', ''), p_lead->>'phone', p_lead->>'message', p_lead->>'address',
    p_lead->>'gender', (p_lead->>'age')::smallint, p_lead->>'nationality', p_lead->>'event',
    coalesce((p_lead->>'marketing_consent')::boolean, false)
  )
  returning id into lid;
  for c in select value from jsonb_array_elements(coalesce(p_consents, '[]'::jsonb)) loop
    insert into public.lead_consents (lead_id, term_version_id, required, agreed, agreed_at)
    select lid, v.id, coalesce((c->>'required')::boolean, false), coalesce((c->>'agreed')::boolean, false),
           case when coalesce((c->>'agreed')::boolean, false) then now() end
      from public.term_versions v join public.terms t on t.id = v.term_id
     where v.id = (c->>'version_id')::uuid and v.published_at is not null and t.site_id = sid
    on conflict do nothing;
  end loop;
  return lid;
end $$;
revoke all on function public.submit_lead(uuid, jsonb, jsonb) from public;
grant execute on function public.submit_lead(uuid, jsonb, jsonb) to anon, authenticated;

-- 5. Default terms for every site -----------------------------------------------------
-- p_legacy: the site already took leads with the old fixed wording, which is kept as version 1.
create or replace function public.ensure_default_terms(p_site uuid, p_legacy boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  owner text;
  privacy uuid;
  marketing uuid;
  n int := 1;
begin
  if exists (select 1 from public.terms where site_id = p_site) then return; end if;
  select coalesce(nullif(trim(name), ''), handle) into owner from public.sites where id = p_site;
  if owner is null then return; end if;

  insert into public.terms (site_id, title, kind, is_default) values (p_site, '기본 개인정보 수집·이용 동의', 'privacy', true) returning id into privacy;
  insert into public.terms (site_id, title, kind, is_default) values (p_site, '마케팅 정보 수신 동의', 'marketing', true) returning id into marketing;

  if p_legacy then
    insert into public.term_versions (term_id, version, label, body, change_note, published_at) values
      (privacy, 1, '개인정보 수집 및 이용에 동의합니다.',
       '약관 관리 기능 도입 전의 신청 폼에는 전문 없이 아래 문구만 표시되었습니다.' || E'\n\n' || '[필수] 개인정보(신청 폼에 입력한 항목) 수집 및 이용에 동의합니다.',
       '기존 신청 폼 문구', now() - interval '1 second'),
      (marketing, 1, '이벤트 및 마케팅 정보 수신에 동의합니다.',
       '약관 관리 기능 도입 전의 신청 폼에는 전문 없이 아래 문구만 표시되었습니다.' || E'\n\n' || '[선택] 이벤트 및 마케팅 정보 수신에 동의합니다.',
       '기존 신청 폼 문구', now() - interval '1 second');
    n := 2;
  end if;

  insert into public.term_versions (term_id, version, label, body, change_note, published_at) values
    (privacy, n, '개인정보 수집 및 이용에 동의합니다.',
     owner || '은(는) 프로모션 신청 확인과 안내를 위해 아래와 같이 개인정보를 수집·이용합니다.' || E'\n\n'
       || '■ 수집 목적: 프로모션 신청 확인 및 안내' || E'\n'
       || '■ 수집 항목: 신청 폼에 입력한 항목(이름, 이메일, 전화번호 등)' || E'\n'
       || '■ 보유 기간: 목적 달성 후 지체 없이 파기 (관련 법령에 따라 보관이 필요한 경우 그 기간)' || E'\n\n'
       || '동의를 거부할 수 있으며, 거부하면 신청이 제한됩니다.',
     '기본 양식', now()),
    (marketing, n, '이벤트 및 마케팅 정보 수신에 동의합니다.',
     owner || '이(가) 보내는 이벤트, 혜택 등 마케팅 정보를 이메일이나 문자로 받는 것에 동의합니다.' || E'\n\n'
       || '■ 이용 목적: 이벤트·혜택 안내, 뉴스레터 발송' || E'\n'
       || '■ 이용 항목: 이메일, 전화번호' || E'\n'
       || '■ 보유 기간: 동의를 철회할 때까지' || E'\n\n'
       || '동의하지 않아도 신청할 수 있으며, 언제든 수신을 거부할 수 있습니다.',
     '기본 양식', now());
end $$;
revoke all on function public.ensure_default_terms(uuid, boolean) from public, anon, authenticated;

create or replace function public.sites_default_terms()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_default_terms(new.id, false);
  return null;
end $$;
drop trigger if exists sites_default_terms on public.sites;
create trigger sites_default_terms after insert on public.sites for each row execute function public.sites_default_terms();

-- 6. Existing sites and leads ---------------------------------------------------------
do $$
declare s record;
begin
  for s in select id, exists (select 1 from public.leads l join public.pages p on p.id = l.page_id where p.site_id = sites.id) as legacy
             from public.sites loop
    perform public.ensure_default_terms(s.id, s.legacy);
  end loop;
end $$;

-- Leads taken before this feature agreed to the old fixed wording (version 1 of the default terms).
-- Leads that already have consent records are skipped, so running this file again changes nothing.
insert into public.lead_consents (lead_id, term_version_id, required, agreed, agreed_at)
select l.id, v.id, t.kind = 'privacy', t.kind = 'privacy' or l.marketing_consent,
       case when t.kind = 'privacy' or l.marketing_consent then l.created_at end
  from public.leads l
  join public.pages p on p.id = l.page_id
  join public.terms t on t.site_id = p.site_id and t.is_default and t.kind in ('privacy', 'marketing')
  join public.term_versions v on v.term_id = t.id and v.version = 1 and v.change_note = '기존 신청 폼 문구'
 where not exists (select 1 from public.lead_consents c where c.lead_id = l.id)
on conflict do nothing;

commit;
