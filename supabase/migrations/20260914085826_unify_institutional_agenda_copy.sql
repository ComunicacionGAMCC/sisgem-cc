update access_control.roles
set description = case code
  when 'sigem_prensa' then 'Consulta exclusivamente la agenda institucional.'
  when 'sigem_alcalde' then 'Consulta toda la gestión municipal sin modificarla y administra únicamente la agenda institucional.'
  else description
end
where code in ('sigem_prensa', 'sigem_alcalde');

update access_control.permissions
set description = case code
  when 'sigem.agenda.read' then 'Consultar actividades pasadas y futuras de la agenda institucional.'
  when 'sigem.agenda.manage' then 'Crear y modificar actividades de la agenda institucional.'
  else description
end
where code in ('sigem.agenda.read', 'sigem.agenda.manage');
