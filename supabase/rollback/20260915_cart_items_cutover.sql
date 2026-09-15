-- Roll back only after the frontend has been restored to the legacy carts.items
-- implementation. The compatibility JSON is maintained by set_cart_line, so no
-- cart contents need to be reconstructed for this rollback.

begin;

drop function if exists public.set_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb, jsonb
);

alter table public.cart_items
  drop constraint if exists cart_items_rental_quote_object;

alter table public.cart_items
  drop column if exists rental_quote;

commit;
