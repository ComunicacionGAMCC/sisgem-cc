-- El Responsable de Recursos Humanos administra el módulo completo de RR. HH.
-- Los permisos se conceden por prefijo para incluir automáticamente nuevas
-- capacidades del módulo que se incorporen en migraciones posteriores.
update access_control.roles
set
  name = 'Responsable de Recursos Humanos',
  description = 'Control total del personal, cargos, contratos, movimientos y planillas salariales del GAMCC.',
  requires_mfa = true,
  active = true
where code = 'sigem_rrhh';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id
from access_control.roles role
cross join access_control.permissions permission
where role.code = 'sigem_rrhh'
  and permission.module = 'sigem'
  and permission.code like 'sigem.hr.%'
on conflict do nothing;

-- Corrige las cuentas existentes cuyo cargo institucional es el responsable
-- de RR. HH. pero que fueron registradas anteriormente con un rol operativo.
insert into access_control.user_role_assignments (
  user_id,
  role_id,
  scope_type,
  scope_id,
  scope_label,
  active
)
select
  profile.id,
  role.id,
  'global'::access_control.scope_type,
  null,
  'Recursos Humanos GAMCC',
  true
from access_control.user_profiles profile
cross join access_control.roles role
where role.code = 'sigem_rrhh'
  and profile.active
  and (
    profile.job_title ilike '%responsable%recursos humanos%'
    or profile.job_title ilike '%responsable%RRHH%'
  )
on conflict (
  user_id,
  role_id,
  scope_type,
  (coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
) where active
do update set
  scope_label = excluded.scope_label,
  valid_until = null,
  updated_at = now();

insert into access_control.audit_events (
  operation,
  target_user_id,
  role_code,
  scope_type,
  detail
)
select
  'hr_full_control_granted',
  profile.id,
  'sigem_rrhh',
  'global'::access_control.scope_type,
  jsonb_build_object(
    'reason', 'Responsable institucional de Recursos Humanos',
    'jobTitle', profile.job_title
  )
from access_control.user_profiles profile
where profile.active
  and (
    profile.job_title ilike '%responsable%recursos humanos%'
    or profile.job_title ilike '%responsable%RRHH%'
  );
