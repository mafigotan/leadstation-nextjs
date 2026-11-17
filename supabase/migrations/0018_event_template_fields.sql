-- Settings a user may change when putting an event template on a promotion (see src/lib/event-fields.ts).

begin;

alter table public.event_templates add column if not exists fields jsonb not null default '[]'::jsonb;

commit;
