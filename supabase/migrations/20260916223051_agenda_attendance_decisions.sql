-- Separa la programación de actividades de la decisión sobre quién asistirá.
insert into access_control.permissions (code, module, name, description)
values (
  'sigem.agenda.decide',
  'sigem',
  'Decidir asistencia a agenda institucional',
  'Confirmar la asistencia del Alcalde Municipal o designar al Secretario Municipal o a un director de área.'
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id
from access_control.roles role
join access_control.permissions permission on permission.code = 'sigem.agenda.decide'
where role.code in ('super_admin', 'sigem_admin', 'sigem_alcalde')
on conflict do nothing;

-- El alcalde conserva lectura completa de la agenda y solo decide la asistencia.
delete from access_control.role_permissions role_permission
using access_control.roles role, access_control.permissions permission
where role_permission.role_id = role.id
  and role_permission.permission_id = permission.id
  and role.code = 'sigem_alcalde'
  and permission.code = 'sigem.agenda.manage';

update access_control.roles
set description = 'Consulta toda la gestión municipal sin modificarla y decide la asistencia a las actividades de la agenda institucional.'
where code = 'sigem_alcalde';
