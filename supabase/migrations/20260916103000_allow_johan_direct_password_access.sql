-- Excepción individual aprobada para que Johan Bergen ingrese con correo y contraseña.
-- El requisito de MFA del rol Alcalde Municipal se conserva para cualquier otra cuenta.

alter table access_control.user_profiles
  add column if not exists mfa_exempt boolean not null default false;

comment on column access_control.user_profiles.mfa_exempt is
  'Exime individualmente la verificación MFA obligatoria del rol. Solo se administra desde base de datos.';

update access_control.user_profiles
set mfa_exempt = true,
    updated_at = now()
where lower(email) = 'johanbergenfriesen@gmail.com';

create or replace function public.access_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', profile.id,
      'email', profile.email,
      'fullName', profile.full_name,
      'jobTitle', profile.job_title,
      'active', profile.active
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', role.code,
        'name', role.name,
        'module', role.module,
        'scopeType', assignment.scope_type,
        'scopeId', assignment.scope_id,
        'scopeLabel', assignment.scope_label
      ) order by role.module, role.name)
      from access_control.user_role_assignments assignment
      join access_control.roles role on role.id = assignment.role_id and role.active
      where assignment.user_id = profile.id and assignment.active
        and assignment.valid_from <= now()
        and (assignment.valid_until is null or assignment.valid_until > now())
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(permission_code order by permission_code)
      from (
        select distinct permission.code as permission_code
        from access_control.user_role_assignments assignment
        join access_control.roles role on role.id = assignment.role_id and role.active
        join access_control.role_permissions role_permission on role_permission.role_id = role.id
        join access_control.permissions permission on permission.id = role_permission.permission_id
        where assignment.user_id = profile.id and assignment.active
          and assignment.valid_from <= now()
          and (assignment.valid_until is null or assignment.valid_until > now())
      ) granted_permissions
    ), '[]'::jsonb),
    'mfaRequired', (not profile.mfa_exempt) and exists (
      select 1
      from access_control.user_role_assignments assignment
      join access_control.roles role on role.id = assignment.role_id
      where assignment.user_id = profile.id and assignment.active and role.active and role.requires_mfa
        and assignment.valid_from <= now()
        and (assignment.valid_until is null or assignment.valid_until > now())
    ),
    'assuranceLevel', coalesce(auth.jwt() ->> 'aal', 'aal1')
  ) into result
  from access_control.user_profiles profile
  where profile.id = current_user_id and profile.active;

  if result is null then
    raise exception 'La cuenta no tiene acceso activo al sistema.' using errcode = '42501';
  end if;
  return result;
end;
$$;

revoke all on function public.access_my_context() from public, anon;
grant execute on function public.access_my_context() to authenticated, service_role;

insert into access_control.audit_events (
  operation,
  target_user_id,
  role_code,
  detail
)
select
  'mfa_exemption_enabled',
  profile.id,
  'sigem_alcalde',
  jsonb_build_object('reason', 'Ingreso directo con credenciales autorizado por Super Administración')
from access_control.user_profiles profile
where lower(profile.email) = 'johanbergenfriesen@gmail.com'
  and not exists (
    select 1
    from access_control.audit_events audit
    where audit.target_user_id = profile.id
      and audit.operation = 'mfa_exemption_enabled'
  );
