-- Alcalde Municipal: consulta global del SIGEM y administración exclusiva de su agenda.
insert into access_control.roles (code, name, module, description, requires_mfa)
values (
  'sigem_alcalde',
  'Alcalde Municipal',
  'sigem',
  'Consulta toda la gestión municipal sin modificarla y administra únicamente la agenda institucional del alcalde.',
  true
)
on conflict (code) do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  requires_mfa = excluded.requires_mfa,
  active = true;

-- Se reemplaza la asignación completa para impedir que este rol acumule permisos de escritura.
delete from access_control.role_permissions role_permission
using access_control.roles role
where role_permission.role_id = role.id
  and role.code = 'sigem_alcalde';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id
from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'sigem.routes.read',
  'sigem.reports.read',
  'sigem.hr.read',
  'sigem.agenda.read',
  'sigem.agenda.manage'
])
where role.code = 'sigem_alcalde'
on conflict do nothing;

comment on table access_control.roles is
  'Catálogo institucional de roles, incluido el acceso global de consulta del Alcalde Municipal.';
