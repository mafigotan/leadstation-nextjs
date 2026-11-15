-- Users ask the super admins for an event game template they cannot find.

begin;

create table if not exists public.event_template_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  game_type text not null default '' check (char_length(game_type) <= 50),
  description text not null check (char_length(description) between 1 and 2000),
  usage text not null default '' check (char_length(usage) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  template_id uuid references public.event_templates (id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists event_template_requests_status_idx on public.event_template_requests (status, created_at desc);

alter table public.event_template_requests enable row level security;
drop policy if exists "members read template requests" on public.event_template_requests;
create policy "members read template requests" on public.event_template_requests for select to authenticated
  using (public.is_site_member(site_id) or public.is_super_admin());
drop policy if exists "super admins update template requests" on public.event_template_requests;
create policy "super admins update template requests" on public.event_template_requests for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Files a request for the caller's working site (at most 3 open requests per site).
create or replace function public.request_event_template(p_game_type text, p_description text, p_usage text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid := public.current_site_id(); rid uuid;
begin
  if sid is null then raise exception 'no site'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'empty description'; end if;
  if (select count(*) from public.event_template_requests where site_id = sid and status = 'pending') >= 3 then
    raise exception 'too many open requests' using errcode = 'P0005';
  end if;
  insert into public.event_template_requests (site_id, user_id, game_type, description, usage)
  values (sid, auth.uid(), left(coalesce(p_game_type, ''), 50), left(trim(p_description), 2000), left(coalesce(p_usage, ''), 1000))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.request_event_template(text, text, text) from public, anon;
grant execute on function public.request_event_template(text, text, text) to authenticated;

-- Super admin answers a request; the requester gets a dashboard notification.
create or replace function public.answer_event_template_request(p_id uuid, p_status text, p_note text, p_template uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.event_template_requests;
begin
  if not public.is_super_admin() then raise exception 'not allowed'; end if;
  if p_status not in ('done', 'rejected') then raise exception 'bad status'; end if;
  update public.event_template_requests
     set status = p_status, admin_note = left(coalesce(p_note, ''), 1000), template_id = p_template, handled_at = now()
   where id = p_id
   returning * into r;
  if r.id is null or r.user_id is null then return; end if;
  insert into public.notifications (user_id, site_id, kind, title, body, ref_id)
  values (
    r.user_id, r.site_id, 'template_request',
    case when p_status = 'done' then '요청하신 이벤트 템플릿이 준비됐어요' else '이벤트 템플릿 요청에 답변이 왔어요' end,
    coalesce(nullif(p_note, ''), case when p_status = 'done' then '프로모션 편집기의 이벤트 요소에서 템플릿을 골라보세요.' else '요청하신 템플릿은 이번에 만들기 어려워요.' end),
    r.id
  );
end $$;
revoke all on function public.answer_event_template_request(uuid, text, text, uuid) from public, anon;
grant execute on function public.answer_event_template_request(uuid, text, text, uuid) to authenticated;

commit;
