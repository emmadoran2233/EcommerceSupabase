begin;

-- Fulfillment rows may receive real seller activity after deployment. Preserve
-- them during rollback; deleting business data based only on origin is unsafe.
revoke execute on function public.backfill_missing_seller_fulfillments()
  from service_role;
drop function if exists public.backfill_missing_seller_fulfillments();

commit;
