# Platform administrator bootstrap

Platform administrators must never be inferred from email, URL parameters, local
storage, or editable Auth metadata. The first administrator is assigned out of band
by a trusted operator after confirming the target row in `auth.users`.

## Before assigning the role

Run this read-only query in the Supabase SQL Editor and verify the UUID and email:

```sql
select id, email, created_at
from auth.users
order by created_at;
```

## Assign the first administrator

Replace both placeholders, then run the transaction in the Supabase SQL Editor. Do
not put the UUID or email into a version-controlled migration.

```sql
begin;

do $$
declare
  target_user_id constant uuid := '<confirmed-auth-user-uuid>';
  bootstrap_reason constant text := '<ticket-or-operational-reason>';
begin
  if not exists (
    select 1 from auth.users where id = target_user_id
  ) then
    raise exception 'Target auth user does not exist';
  end if;

  insert into public.user_roles (user_id, role, source)
  values (target_user_id, 'platform_admin', 'manual_admin')
  on conflict (user_id, role) do nothing;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    target_type,
    target_id,
    reason,
    after_data
  )
  values (
    target_user_id,
    'platform_admin.bootstrapped',
    'user_role',
    target_user_id::text,
    bootstrap_reason,
    jsonb_build_object('role', 'platform_admin', 'source', 'manual_admin')
  );
end
$$;

commit;
```

## Verify

```sql
select user_id, role, source, created_at
from public.user_roles
where role = 'platform_admin';

select actor_user_id, action, target_id, reason, created_at
from public.admin_audit_logs
where action = 'platform_admin.bootstrapped'
order by created_at desc;
```

Keep the number of platform administrators small. Subsequent role-management UI or
APIs should require step-up authentication and write an append-only audit record.

