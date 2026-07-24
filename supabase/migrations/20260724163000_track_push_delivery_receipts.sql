alter table public.push_tokens
  add constraint push_tokens_id_society_unique unique (id, society_id);

create table public.push_delivery_receipts (
  ticket_id text primary key,
  society_id uuid not null references public.societies(id) on delete cascade,
  push_token_id uuid,
  notification_type text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'DELIVERED', 'ERROR')),
  error_code text,
  sent_at timestamptz not null default statement_timestamp(),
  checked_at timestamptz,
  foreign key (push_token_id, society_id)
    references public.push_tokens(id, society_id)
    on delete set null (push_token_id)
);

create index push_delivery_receipts_pending_idx
  on public.push_delivery_receipts (society_id, sent_at)
  where status = 'PENDING';

alter table public.push_delivery_receipts enable row level security;
revoke all on table public.push_delivery_receipts from anon, authenticated;
