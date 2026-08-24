create or replace function public.access_bootstrap_super_admin(
  target_user_id uuid,
  target_email text,
  target_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  normalized_name text := left(trim(coalesce(target_full_name, '')), 220);
  super_role_id uuid;
  active_super_admins integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operación exclusiva del servidor.' using errcode = '42501';
  end if;
  if target_user_id is null or normalized_email = '' or normalized_name = '' then
    raise exception 'La identidad, el correo y el nombre son obligatorios.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('access_control.bootstrap_super_admin', 0)
  );

  if not exists (
    select 1
    from auth.users
    where id = target_user_id and lower(email) = normalized_email
  ) then
    raise exception 'La identidad indicada no existe en Supabase Auth.';
  end if;

  select id into super_role_id
  from access_control.roles
  where code = 'super_admin' and active;

  if super_role_id is null then
    raise exception 'El rol de superadministración no está disponible.';
  end if;

  insert into access_control.user_profiles (id, email, full_name, job_title, active)
  values (target_user_id, normalized_email, normalized_name, 'Superadministrador', true)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    job_title = excluded.job_title,
    active = true,
    updated_at = now();

  if exists (
    select 1
    from access_control.user_role_assignments assignment
    where assignment.user_id = target_user_id
      and assignment.role_id = super_role_id
      and assignment.active
  ) then
    return jsonb_build_object(
      'userId', target_user_id,
      'role', 'super_admin',
      'configured', true,
      'alreadyConfigured', true
    );
  end if;

  select count(distinct assignment.user_id)::integer into active_super_admins
  from access_control.user_role_assignments assignment
  where assignment.role_id = super_role_id and assignment.active;

  if active_super_admins >= 2 then
    raise exception 'Los dos cupos iniciales de superadministración ya fueron configurados.';
  end if;

  insert into access_control.user_role_assignments (
    user_id, role_id, scope_type, assigned_by
  ) values (target_user_id, super_role_id, 'global', null);

  insert into access_control.audit_events (
    operation, target_user_id, role_code, scope_type, detail
  ) values (
    'super_admin_bootstrapped', target_user_id, 'super_admin', 'global',
    jsonb_build_object('fullName', normalized_name, 'bootstrapSlot', active_super_admins + 1)
  );

  return jsonb_build_object(
    'userId', target_user_id,
    'role', 'super_admin',
    'configured', true,
    'alreadyConfigured', false,
    'bootstrapSlot', active_super_admins + 1
  );
end;
$$;

revoke all on function public.access_bootstrap_super_admin(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.access_bootstrap_super_admin(uuid, text, text)
  to service_role;
