-- User site landing: promotion period, and the site's logo and footer information.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. (여러 번 실행해도 괜찮아요.)

begin;

-- 1) Promotion period (Korean dates). Empty means no limit on that side.
alter table public.pages add column if not exists starts_on date;
alter table public.pages add column if not exists ends_on date;
alter table public.pages drop constraint if exists pages_period_check;
alter table public.pages add constraint pages_period_check check (starts_on is null or ends_on is null or starts_on <= ends_on);
create index if not exists pages_site_period_idx on public.pages (site_id, status, ends_on);

-- 2) Site logo and footer information, shown on the user site.
alter table public.sites add column if not exists logo_url text not null default '' check (char_length(logo_url) <= 2000);
alter table public.sites add column if not exists company_name text not null default '' check (char_length(company_name) <= 100);
alter table public.sites add column if not exists ceo_name text not null default '' check (char_length(ceo_name) <= 50);
alter table public.sites add column if not exists business_no text not null default '' check (char_length(business_no) <= 30);
alter table public.sites add column if not exists address text not null default '' check (char_length(address) <= 300);
alter table public.sites add column if not exists contact_phone text not null default '' check (char_length(contact_phone) <= 30);
alter table public.sites add column if not exists contact_email text not null default '' check (char_length(contact_email) <= 200);

-- The sites table uses column grants (admin_memo stays private): open the new columns.
grant select (logo_url, company_name, ceo_name, business_no, address, contact_phone, contact_email) on public.sites to anon, authenticated;
grant update (logo_url, company_name, ceo_name, business_no, address, contact_phone, contact_email) on public.sites to authenticated;

commit;
