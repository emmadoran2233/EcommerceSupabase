-- Customizations table used by the Product page modal.
-- Run via `supabase db push` or inside the SQL editor.
create table if not exists public.customizations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  text_line_1 text,
  text_line_2 text,
  text_line_3 text,
  font text default 'serif',
  color text default '#111827',
  created_at timestamptz default now()
);

create index if not exists customizations_user_product_idx
  on public.customizations (user_id, product_id);
