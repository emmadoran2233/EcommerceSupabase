-- Emergency compatibility rollback for the 2026-09-08 database expansion.
--
-- This intentionally does not drop additive tables, columns, constraints, or
-- backfilled rows. The storefront and seller portal still read legacy structures,
-- so preserving new data is safer than a destructive down migration.

begin;

-- Restore the legacy seller-portal behavior for global BannerControl.
drop policy if exists "Platform admins can create banners" on public.banner;
drop policy if exists "Platform admins can update banners" on public.banner;
drop policy if exists "Platform admins can delete banners" on public.banner;

drop policy if exists "Authenticated users can manage banners" on public.banner;
create policy "Authenticated users can manage banners"
  on public.banner
  for all
  to authenticated
  using (true)
  with check (true);

-- Prevent browser callers from invoking another backfill while compatibility
-- rollback is active. The service role may still run a reviewed recovery.
revoke execute on function public.backfill_relational_data() from anon, authenticated;

commit;

