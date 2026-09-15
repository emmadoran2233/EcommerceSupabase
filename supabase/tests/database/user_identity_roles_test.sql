begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select has_table(
  'public',
  'user_roles',
  'user_roles should exist'
);

select ok(
  (
    select count(*) = 1
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype = 'p'
  ),
  'user_roles should have one composite primary key'
);

select ok(
  (
    select count(*) = 1
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ),
  'user_roles.user_id should reference auth.users'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.user_roles'::regclass
  ),
  'RLS should be enabled on user_roles'
);

select has_table(
  'public',
  'seller_accounts',
  'seller_accounts should exist'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.seller_accounts'::regclass
  ),
  'RLS should be enabled on seller_accounts'
);

select policies_are(
  'public',
  'user_roles',
  array[
    'Platform admins can view all user roles',
    'Users can view their own marketplace roles'
  ],
  'user_roles should expose only owner and platform-admin reads'
);

select has_function(
  'public',
  'sync_auth_user_identity',
  array[]::text[],
  'the Auth identity sync function should exist'
);

select is_definer(
  'public',
  'sync_auth_user_identity',
  array[]::text[],
  'the Auth identity sync function should run as its owner'
);

select has_function(
  'public',
  'register_seller_account',
  array[]::text[],
  'the seller onboarding function should exist'
);

select is_definer(
  'public',
  'register_seller_account',
  array[]::text[],
  'the seller registration function should use its restricted owner privileges'
);

select has_function(
  'public',
  'has_active_seller_account',
  array[]::text[],
  'the active seller authorization helper should exist'
);

select has_function(
  'public',
  'has_user_role',
  array['text'],
  'active buyer capability should be queryable through the role helper'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_identity_created'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ),
  'new Auth users should be synchronized by a trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'users_id_auth_users_fkey'
      and conrelid = 'public.users'::regclass
      and confrelid = 'auth.users'::regclass
  ),
  'legacy public.users ids should be constrained to auth.users'
);

select policies_are(
  'public',
  'seller_accounts',
  array[
    'Platform admins can view all seller accounts',
    'Users can view their own seller account'
  ],
  'seller accounts should expose only owner and platform-admin reads'
);

select has_index(
  'public',
  'seller_accounts',
  'idx_seller_accounts_status_user_id',
  'seller account status lookups should be indexed'
);

select * from finish();
rollback;
