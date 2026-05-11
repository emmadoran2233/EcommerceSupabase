create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id bigint references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  recipient_email text not null,
  recipient_role text not null,
  seller_id uuid references auth.users(id) on delete set null,
  subject text not null,
  status text not null default 'pending',
  provider_id text,
  error_message text,
  idempotency_key text not null unique,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_events_order_id
  on public.email_events (order_id);

create index if not exists idx_email_events_user_id
  on public.email_events (user_id);

create index if not exists idx_email_events_status
  on public.email_events (status);
