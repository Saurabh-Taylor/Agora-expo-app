-- Gate-pass lifecycle values are committed separately because PostgreSQL
-- requires new enum values to be committed before later migrations use them.

alter type public.visitor_request_status add value if not exists 'CANCELLED';
alter type public.visitor_request_status add value if not exists 'EXPIRED';
