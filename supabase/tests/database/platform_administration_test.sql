begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

select has_table(
  'public',
  'admin_audit_logs',
  'admin_audit_logs should exist'
);

select ok(
  (
    select count(*) = 1
    from pg_constraint
    where conrelid = 'public.admin_audit_logs'::regclass
      and contype = 'p'
  ),
  'admin audit logs should have a primary key'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.admin_audit_logs'::regclass
  ),
  'RLS should be enabled on admin audit logs'
);

select policies_are(
  'public',
  'admin_audit_logs',
  array['Platform admins can view audit logs'],
  'only platform admins should be able to read audit logs'
);

select has_function(
  'public',
  'is_platform_admin',
  array[]::text[],
  'the platform-admin authorization helper should exist'
);

select is_definer(
  'public',
  'is_platform_admin',
  array[]::text[],
  'the platform-admin authorization helper should bypass recursive RLS safely'
);

select has_function(
  'public',
  'set_seller_account_status',
  array['uuid', 'text', 'text'],
  'the audited seller status function should exist'
);

select is_definer(
  'public',
  'set_seller_account_status',
  array['uuid', 'text', 'text'],
  'seller status changes should run through a privileged function'
);

select policies_are(
  'public',
  'banner',
  array[
    'Active banners are public',
    'Platform admins can create banners',
    'Platform admins can delete banners',
    'Platform admins can update banners'
  ],
  'global banner writes should be restricted to platform admins'
);

select ok(
  not has_table_privilege('authenticated', 'public.admin_audit_logs', 'INSERT'),
  'browser users should not be able to forge audit log entries'
);

select * from finish();
rollback;

