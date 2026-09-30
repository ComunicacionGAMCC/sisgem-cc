update access_control.user_profiles
set job_title = case
  when lower(job_title) = lower('Directora Administrativa Hospital Municipal') then 'Director Administrativo Municipal de Salud'
  when lower(job_title) = lower('Profesional I Responsable de Recursos Humanos') then 'Responsable de Recursos Humanos'
  when lower(job_title) = lower('Técnico II Chofer Ejecutivo') then 'Chofer del Ejecutivo y Coordinador'
  when lower(job_title) = lower('Técnico III Secretaria de Gabinete') then 'Técnico III Secretaría de Gabinete'
  else job_title
end,
updated_at = now()
where lower(job_title) in (
  lower('Directora Administrativa Hospital Municipal'),
  lower('Profesional I Responsable de Recursos Humanos'),
  lower('Técnico II Chofer Ejecutivo'),
  lower('Técnico III Secretaria de Gabinete')
);
