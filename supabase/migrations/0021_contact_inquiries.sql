-- 소개 페이지의 "문의하기" 모달로 들어온 도입 문의.
-- 방문자(비로그인)는 submit_contact_inquiry() 로만 저장하고, 목록은 슈퍼 관리자만 읽어요.
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. (0020 다음)

begin;

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  message text not null,
  page text not null default '',
  ip text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists contact_inquiries_created_idx on public.contact_inquiries (created_at desc);
create index if not exists contact_inquiries_ip_idx on public.contact_inquiries (ip, created_at desc);

alter table public.contact_inquiries enable row level security;
drop policy if exists "super admins read inquiries" on public.contact_inquiries;
create policy "super admins read inquiries" on public.contact_inquiries for select to authenticated using (public.is_super_admin());

-- Saves one inquiry. Refuses more than 5 from the same address in 10 minutes.
create or replace function public.submit_contact_inquiry(p_name text, p_email text, p_phone text, p_message text, p_page text, p_ip text)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if coalesce(p_ip, '') <> '' and (
    select count(*) from public.contact_inquiries where ip = p_ip and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'too many inquiries' using errcode = 'P0001';
  end if;
  insert into public.contact_inquiries (name, email, phone, message, page, ip)
  values (left(p_name, 100), left(p_email, 200), left(p_phone, 50), left(p_message, 3000), left(coalesce(p_page, ''), 200), left(coalesce(p_ip, ''), 100))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.submit_contact_inquiry(text, text, text, text, text, text) from public;
grant execute on function public.submit_contact_inquiry(text, text, text, text, text, text) to anon, authenticated;

commit;
