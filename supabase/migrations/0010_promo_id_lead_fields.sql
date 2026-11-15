-- Promotion ID ({year}{seq}, e.g. 202601) per site, and more lead form fields.

begin;

-- 1) Promotion ID -----------------------------------------------------------
alter table public.pages add column if not exists promo_no text;

-- Number existing pages by creation order within each site and year (KST).
with n as (
  select id,
         to_char(created_at at time zone 'Asia/Seoul', 'YYYY') as y,
         row_number() over (partition by site_id, to_char(created_at at time zone 'Asia/Seoul', 'YYYY') order by created_at, id) as seq
  from public.pages
  where promo_no is null
)
update public.pages p
   set promo_no = n.y || case when n.seq < 10 then '0' || n.seq else n.seq::text end
  from n
 where p.id = n.id;

create unique index if not exists pages_site_promo_no_idx on public.pages (site_id, promo_no);

create or replace function public.assign_promo_no()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  y text := to_char(coalesce(new.created_at, now()) at time zone 'Asia/Seoul', 'YYYY');
  n int;
begin
  if tg_op = 'UPDATE' then
    new.promo_no := old.promo_no;  -- assigned once, never edited
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('promo_no:' || new.site_id::text));
  select coalesce(max(substr(promo_no, 5)::int), 0) + 1 into n
    from public.pages
   where site_id = new.site_id and promo_no like y || '%' and substr(promo_no, 5) ~ '^[0-9]+$';
  new.promo_no := y || case when n < 10 then '0' || n else n::text end;
  return new;
end;
$$;

drop trigger if exists pages_assign_promo_no on public.pages;
create trigger pages_assign_promo_no
before insert or update of promo_no on public.pages
for each row execute function public.assign_promo_no();

-- 2) Lead form fields -----------------------------------------------------------
-- Name and email become optional: a form may ask for other fields only.
alter table public.leads drop constraint if exists leads_name_check;
alter table public.leads drop constraint if exists leads_email_check;
alter table public.leads alter column name set default '';
alter table public.leads alter column email set default '';
alter table public.leads add constraint leads_name_check check (char_length(name) <= 100);
alter table public.leads add constraint leads_email_check check (email = '' or char_length(email) between 3 and 200);

alter table public.leads add column if not exists address text check (char_length(address) <= 300);
alter table public.leads add column if not exists gender text check (char_length(gender) <= 20);
alter table public.leads add column if not exists age smallint check (age between 0 and 150);
alter table public.leads add column if not exists nationality text check (char_length(nationality) <= 100);

commit;
