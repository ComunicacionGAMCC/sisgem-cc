-- Permisos de Recursos Humanos y agenda institucional.
insert into access_control.roles (code, name, module, description, requires_mfa)
values
  ('sigem_rrhh', 'Responsable de Recursos Humanos', 'sigem', 'Administra personal, contratos, cargos y planillas salariales del GAMCC.', true),
  ('sigem_prensa', 'Prensa / Medio externo', 'sigem', 'Consulta exclusivamente la agenda institucional del alcalde.', false)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  requires_mfa = excluded.requires_mfa,
  active = true;

insert into access_control.permissions (code, module, name, description)
values
  ('sigem.agenda.read', 'sigem', 'Consultar agenda institucional', 'Consultar actividades pasadas y futuras de la agenda del alcalde.'),
  ('sigem.agenda.manage', 'sigem', 'Administrar agenda institucional', 'Crear y modificar actividades de la agenda del alcalde.'),
  ('sigem.hr.read', 'sigem', 'Consultar Recursos Humanos', 'Consultar personal, cargos, contratos y planillas del GAMCC.'),
  ('sigem.hr.manage', 'sigem', 'Administrar Recursos Humanos', 'Registrar y actualizar personal, cargos, contratos y movimientos.'),
  ('sigem.hr.payroll', 'sigem', 'Administrar planillas salariales', 'Generar planillas y registrar bonos y descuentos salariales.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id
from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'sigem.agenda.read', 'sigem.agenda.manage',
  'sigem.hr.read', 'sigem.hr.manage', 'sigem.hr.payroll'
])
where role.code in ('super_admin', 'sigem_admin')
on conflict do nothing;

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id
from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'sigem.hr.read', 'sigem.hr.manage', 'sigem.hr.payroll',
  'sigem.routes.read', 'sigem.reports.read'
])
where role.code = 'sigem_rrhh'
on conflict do nothing;

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id
from access_control.roles role
join access_control.permissions permission on permission.code = 'sigem.agenda.read'
where role.code = 'sigem_prensa'
on conflict do nothing;

comment on table access_control.roles is
  'Catálogo institucional de roles, incluidos Recursos Humanos y Prensa externa.';
