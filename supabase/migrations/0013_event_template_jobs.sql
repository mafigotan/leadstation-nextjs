-- Event templates are generated through the Message Batches API (no server time limit).

begin;

alter table public.event_templates add column if not exists job_batch_id text;
alter table public.event_templates add column if not exists job_kind text check (job_kind in ('create', 'revise'));

commit;
