-- SendGrid Event Webhook: bounces, spam reports and unsubscribes reported by SendGrid
-- update newsletter recipients and send logs (see src/app/api/webhooks/sendgrid/route.ts).
-- Supabase SQL Editor 에 이 파일 내용 전체를 붙여넣고 Run 하세요. (0019 다음)

begin;

-- Recipients: two new states that block future sends, like 'unsubscribed'.
--   bounced    : SendGrid reported a hard bounce (address does not exist, etc.)
--   complained : the recipient marked the mail as spam
alter table public.recipients drop constraint if exists recipients_status_check;
alter table public.recipients add constraint recipients_status_check
  check (status in ('subscribed', 'unsubscribed', 'bounced', 'complained'));
alter table public.recipients add column if not exists status_reason text not null default '';

-- Send logs: what happened after SendGrid accepted the mail.
--   '' (unknown yet) | delivered | bounced | blocked | dropped | spamreport
alter table public.send_logs add column if not exists delivery text not null default '';
alter table public.send_logs add column if not exists delivery_at timestamptz;

commit;
