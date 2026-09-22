begin;

drop function if exists public.set_normalized_cart_line(
  uuid, text, integer, text, jsonb, date, date, jsonb
);

commit;
