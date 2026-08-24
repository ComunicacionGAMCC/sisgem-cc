-- Directorio único de identidades y control de accesos para SIGEM y Salud.
-- Las credenciales viven en Supabase Auth. Los roles y permisos viven aquí;
-- nunca se confía en user_metadata para autorizar acciones.

create schema if not exists access_control;
revoke all on schema access_control from public, anon, authenticated;
grant usage on schema access_control to service_role;

create type access_control.module_code as enum ('platform', 'sigem', 'health');
create type access_control.scope_type as enum ('global', 'municipal_unit', 'facility');

create table access_control.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name varchar(220) not null,
  job_title varchar(180),
  employee_number varchar(60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table access_control.roles (
  id uuid primary key default gen_random_uuid(),
  code varchar(80) not null unique,
  name varchar(140) not null,
  module access_control.module_code not null,
  description text not null,
  requires_mfa boolean not null default false,
  system_role boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table access_control.permissions (
  id uuid primary key default gen_random_uuid(),
  code varchar(120) not null unique,
  module access_control.module_code not null,
  name varchar(160) not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table access_control.role_permissions (
  role_id uuid not null references access_control.roles(id) on delete cascade,
  permission_id uuid not null references access_control.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table access_control.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references access_control.user_profiles(id) on delete cascade,
  role_id uuid not null references access_control.roles(id) on delete restrict,
  scope_type access_control.scope_type not null default 'global',
  scope_id uuid,
  scope_label varchar(180),
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  assigned_by uuid references access_control.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'global' and scope_id is null)
    or (scope_type <> 'global' and scope_id is not null)
  ),
  check (valid_until is null or valid_until > valid_from)
);

create unique index user_role_assignments_active_uidx
  on access_control.user_role_assignments (
    user_id, role_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where active;
create index user_role_assignments_user_active_idx
  on access_control.user_role_assignments (user_id, role_id)
  where active;
create index user_role_assignments_role_scope_idx
  on access_control.user_role_assignments (role_id, scope_type, scope_id)
  where active;
create index role_permissions_permission_idx
  on access_control.role_permissions (permission_id, role_id);

create table access_control.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  operation varchar(80) not null,
  target_user_id uuid references auth.users(id) on delete set null,
  role_code varchar(80),
  scope_type access_control.scope_type,
  scope_id uuid,
  detail jsonb not null default '{}'::jsonb
);

create index access_audit_occurred_idx on access_control.audit_events (occurred_at desc);
create index access_audit_actor_idx on access_control.audit_events (actor_user_id, occurred_at desc)
  where actor_user_id is not null;
create index access_audit_target_idx on access_control.audit_events (target_user_id, occurred_at desc)
  where target_user_id is not null;

create function access_control.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger access_profiles_set_updated_at
before update on access_control.user_profiles
for each row execute function access_control.set_updated_at();

create trigger access_assignments_set_updated_at
before update on access_control.user_role_assignments
for each row execute function access_control.set_updated_at();

create function access_control.prevent_audit_changes()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Los eventos de auditoría de acceso son inmutables.';
end;
$$;

create trigger access_audit_immutable
before update or delete on access_control.audit_events
for each row execute function access_control.prevent_audit_changes();

insert into access_control.roles (code, name, module, description, requires_mfa) values
  ('super_admin', 'Superadministrador', 'platform', 'Gobierno completo de identidades, accesos y configuración de la plataforma.', true),
  ('sigem_admin', 'Administrador SIGEM', 'sigem', 'Jefatura de Sistemas o Recursos Humanos; administra usuarios y accesos municipales.', true),
  ('sigem_secretaria_general', 'Secretaría General', 'sigem', 'Registra, recibe y deriva hojas de ruta institucionales.', false),
  ('sigem_direccion', 'Dirección municipal', 'sigem', 'Gestiona trámites y servidores dentro de una dirección asignada.', false),
  ('sigem_unidad', 'Unidad municipal', 'sigem', 'Gestiona trámites dentro de una unidad asignada.', false),
  ('sigem_servidor', 'Servidor público', 'sigem', 'Acceso operativo limitado al cargo y unidad asignados.', false),
  ('health_admin', 'Administrador de Salud', 'health', 'Administra usuarios, roles y operación del Hospital Municipal.', true),
  ('health_admission', 'Admisión / Secretaría', 'health', 'Registra pacientes por primera vez y administra fichas y citas.', true),
  ('health_physician', 'Médico', 'health', 'Consulta y registra atención clínica de sus pacientes.', true),
  ('health_nursing', 'Enfermería', 'health', 'Registra cuidados, signos vitales y evolución de enfermería.', true),
  ('health_pharmacy', 'Farmacia', 'health', 'Consulta prescripciones habilitadas para dispensación.', true),
  ('health_auditor', 'Auditoría médica', 'health', 'Acceso de auditoría clínica trazable y de solo lectura.', true);

insert into access_control.permissions (code, module, name, description) values
  ('platform.users.manage', 'platform', 'Administrar todos los usuarios', 'Invitar usuarios y asignar roles de cualquier módulo.'),
  ('platform.audit.read', 'platform', 'Consultar auditoría de plataforma', 'Consultar eventos de seguridad y administración de accesos.'),
  ('sigem.users.manage', 'sigem', 'Administrar usuarios SIGEM', 'Invitar y administrar usuarios exclusivamente municipales.'),
  ('sigem.routes.create', 'sigem', 'Registrar hojas de ruta', 'Registrar trámites recibidos por el GAMCC.'),
  ('sigem.routes.read', 'sigem', 'Consultar hojas de ruta', 'Consultar trámites dentro del ámbito asignado.'),
  ('sigem.routes.receive', 'sigem', 'Recibir hojas de ruta', 'Confirmar recepción en el área asignada.'),
  ('sigem.routes.route', 'sigem', 'Derivar hojas de ruta', 'Derivar trámites entre áreas autorizadas.'),
  ('sigem.routes.update', 'sigem', 'Actualizar hojas de ruta', 'Actualizar estado y actuaciones del trámite.'),
  ('sigem.routes.close', 'sigem', 'Cerrar hojas de ruta', 'Finalizar o archivar trámites autorizados.'),
  ('sigem.reports.read', 'sigem', 'Consultar reportes SIGEM', 'Consultar indicadores y reportes institucionales.'),
  ('health.users.manage', 'health', 'Administrar usuarios de Salud', 'Invitar y administrar personal hospitalario.'),
  ('health.patients.register', 'health', 'Registrar pacientes', 'Crear el registro inicial y actualizar datos demográficos.'),
  ('health.patients.read', 'health', 'Consultar pacientes', 'Consultar identidad y datos demográficos de pacientes.'),
  ('health.appointments.read', 'health', 'Consultar citas', 'Consultar fichas y agenda hospitalaria.'),
  ('health.appointments.manage', 'health', 'Administrar citas', 'Crear, confirmar, reprogramar o cancelar fichas.'),
  ('health.clinical.read', 'health', 'Consultar historia clínica', 'Consultar antecedentes y atenciones clínicas con MFA.'),
  ('health.clinical.write', 'health', 'Registrar atención clínica', 'Crear notas, diagnósticos y registros asistenciales con MFA.'),
  ('health.prescriptions.read', 'health', 'Consultar prescripciones', 'Consultar prescripciones habilitadas.'),
  ('health.prescriptions.write', 'health', 'Emitir prescripciones', 'Emitir prescripciones como profesional autorizado.'),
  ('health.audit.read', 'health', 'Consultar auditoría médica', 'Consultar trazabilidad del sistema de Salud con MFA.');

-- Superadministración: gobierno integral, sin lectura clínica automática.
insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id
from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'platform.users.manage', 'platform.audit.read', 'sigem.users.manage',
  'sigem.routes.create', 'sigem.routes.read', 'sigem.routes.receive',
  'sigem.routes.route', 'sigem.routes.update', 'sigem.routes.close',
  'sigem.reports.read', 'health.users.manage', 'health.patients.register',
  'health.patients.read', 'health.appointments.read', 'health.appointments.manage',
  'health.audit.read'
])
where role.code = 'super_admin';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id
from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'sigem.users.manage', 'sigem.routes.create', 'sigem.routes.read',
  'sigem.routes.receive', 'sigem.routes.route', 'sigem.routes.update',
  'sigem.routes.close', 'sigem.reports.read'
])
where role.code = 'sigem_admin';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'sigem.routes.create', 'sigem.routes.read', 'sigem.routes.receive',
  'sigem.routes.route', 'sigem.routes.update'
]) where role.code = 'sigem_secretaria_general';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'sigem.routes.read', 'sigem.routes.receive', 'sigem.routes.route',
  'sigem.routes.update', 'sigem.routes.close', 'sigem.reports.read'
]) where role.code = 'sigem_direccion';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'sigem.routes.read', 'sigem.routes.receive', 'sigem.routes.route',
  'sigem.routes.update', 'sigem.routes.close'
]) where role.code = 'sigem_unidad';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'sigem.routes.read', 'sigem.routes.receive', 'sigem.routes.update'
]) where role.code = 'sigem_servidor';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'health.users.manage', 'health.patients.register', 'health.patients.read',
  'health.appointments.read', 'health.appointments.manage', 'health.audit.read'
]) where role.code = 'health_admin';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'health.patients.register', 'health.patients.read',
  'health.appointments.read', 'health.appointments.manage'
]) where role.code = 'health_admission';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'health.patients.read', 'health.appointments.read', 'health.clinical.read',
  'health.clinical.write', 'health.prescriptions.read', 'health.prescriptions.write'
]) where role.code = 'health_physician';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'health.patients.read', 'health.appointments.read',
  'health.clinical.read', 'health.clinical.write'
]) where role.code = 'health_nursing';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'health.patients.read', 'health.prescriptions.read'
]) where role.code = 'health_pharmacy';

insert into access_control.role_permissions (role_id, permission_id)
select role.id, permission.id from access_control.roles role
join access_control.permissions permission on permission.code = any(array[
  'health.clinical.read', 'health.audit.read'
]) where role.code = 'health_auditor';

create function access_control.has_permission(
  permission_code text,
  requested_scope_type access_control.scope_type default null,
  requested_scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from access_control.user_profiles profile
    join access_control.user_role_assignments assignment on assignment.user_id = profile.id
    join access_control.roles role on role.id = assignment.role_id and role.active
    join access_control.role_permissions role_permission on role_permission.role_id = role.id
    join access_control.permissions permission on permission.id = role_permission.permission_id
    where profile.id = (select auth.uid())
      and profile.active
      and assignment.active
      and assignment.valid_from <= now()
      and (assignment.valid_until is null or assignment.valid_until > now())
      and permission.code = permission_code
      and (
        requested_scope_type is null
        or assignment.scope_type = 'global'
        or (
          assignment.scope_type = requested_scope_type
          and (requested_scope_id is null or assignment.scope_id = requested_scope_id)
        )
      )
  );
$$;

create function access_control.has_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from access_control.user_profiles profile
    join access_control.user_role_assignments assignment on assignment.user_id = profile.id
    join access_control.roles role on role.id = assignment.role_id
    where profile.id = (select auth.uid())
      and profile.active and assignment.active and role.active
      and assignment.valid_from <= now()
      and (assignment.valid_until is null or assignment.valid_until > now())
      and role.code = role_code
  );
$$;

create function access_control.can_assign_role(target_role_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select case
    when (select access_control.has_role('super_admin')) then true
    when target_role.module = 'sigem'
      then (select access_control.has_permission('sigem.users.manage'))
    when target_role.module = 'health'
      then (select access_control.has_permission('health.users.manage'))
    else false
  end
  from access_control.roles target_role
  where target_role.code = target_role_code and target_role.active;
$$;

create function access_control.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into access_control.user_profiles (id, email, full_name)
  values (
    new.id,
    lower(coalesce(new.email, new.id::text || '@sin-correo.local')),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Usuario'), '@', 1)), 220)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    updated_at = now();
  return new;
end;
$$;

create trigger access_on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function access_control.handle_new_auth_user();

create function public.access_my_context()
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
    'mfaRequired', exists (
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

create function public.access_roles_catalog()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', role.code,
    'name', role.name,
    'module', role.module,
    'description', role.description,
    'requiresMfa', role.requires_mfa
  ) order by role.module, role.name), '[]'::jsonb)
  from access_control.roles role
  where role.active and (select access_control.can_assign_role(role.code));
$$;

create function public.access_list_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not (
    (select access_control.has_permission('platform.users.manage'))
    or (select access_control.has_permission('sigem.users.manage'))
    or (select access_control.has_permission('health.users.manage'))
  ) then
    raise exception 'No tienes permiso para administrar usuarios.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Se requiere verificación en dos pasos.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(user_item order by user_item ->> 'fullName')
    from (
      select jsonb_build_object(
        'id', profile.id,
        'email', profile.email,
        'fullName', profile.full_name,
        'jobTitle', profile.job_title,
        'active', profile.active,
        'roles', jsonb_agg(jsonb_build_object(
          'code', role.code,
          'name', role.name,
          'module', role.module,
          'scopeType', assignment.scope_type,
          'scopeId', assignment.scope_id,
          'scopeLabel', assignment.scope_label
        ) order by role.module, role.name)
      ) as user_item
      from access_control.user_profiles profile
      join access_control.user_role_assignments assignment on assignment.user_id = profile.id and assignment.active
      join access_control.roles role on role.id = assignment.role_id and role.active
      where
        (select access_control.has_permission('platform.users.manage'))
        or (role.module = 'sigem' and (select access_control.has_permission('sigem.users.manage')))
        or (role.module = 'health' and (select access_control.has_permission('health.users.manage')))
      group by profile.id
    ) listed_users
  ), '[]'::jsonb);
end;
$$;

create function public.access_register_invited_user(
  target_user_id uuid,
  target_email text,
  target_full_name text,
  target_role_code text,
  target_scope_type text default 'global',
  target_scope_id uuid default null,
  target_scope_label text default null,
  target_job_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_user_id uuid := auth.uid();
  target_role access_control.roles%rowtype;
  normalized_scope_type access_control.scope_type;
  facility_id_value uuid;
  health_role_value health.staff_role;
begin
  if actor_user_id is null or not (select access_control.can_assign_role(target_role_code)) then
    raise exception 'No tienes permiso para asignar este rol.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Se requiere verificación en dos pasos.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.users
    where id = target_user_id and lower(email) = lower(trim(target_email))
  ) then
    raise exception 'La identidad invitada no coincide con Supabase Auth.';
  end if;

  select * into target_role from access_control.roles
  where code = target_role_code and active;
  if not found then raise exception 'El rol seleccionado no existe.'; end if;

  begin
    normalized_scope_type := target_scope_type::access_control.scope_type;
  exception when invalid_text_representation then
    raise exception 'El ámbito seleccionado no es válido.';
  end;

  if target_role.module = 'health' and normalized_scope_type not in ('global', 'facility') then
    raise exception 'Los roles de Salud solo aceptan ámbito hospitalario.';
  end if;
  if target_role.module = 'sigem' and normalized_scope_type = 'facility' then
    raise exception 'Los roles SIGEM no aceptan ámbito hospitalario.';
  end if;

  insert into access_control.user_profiles (id, email, full_name, job_title, active)
  values (
    target_user_id, lower(trim(target_email)), left(trim(target_full_name), 220),
    nullif(left(trim(coalesce(target_job_title, '')), 180), ''), true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    job_title = excluded.job_title,
    active = true,
    updated_at = now();

  insert into access_control.user_role_assignments (
    user_id, role_id, scope_type, scope_id, scope_label, assigned_by
  ) values (
    target_user_id, target_role.id, normalized_scope_type, target_scope_id,
    nullif(left(trim(coalesce(target_scope_label, '')), 180), ''), actor_user_id
  )
  on conflict (
    user_id, role_id, scope_type,
    (coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ) where active
  do update set
    scope_label = excluded.scope_label,
    assigned_by = excluded.assigned_by,
    updated_at = now();

  if target_role.module = 'health' then
    select id into facility_id_value from health.facilities
    where id = target_scope_id or (target_scope_id is null and code = 'HMC4C')
    order by case when id = target_scope_id then 0 else 1 end
    limit 1;
    if facility_id_value is null then raise exception 'El Hospital Municipal no está configurado.'; end if;

    health_role_value := case target_role.code
      when 'health_admin' then 'administrador_salud'::health.staff_role
      when 'health_admission' then 'admision'::health.staff_role
      when 'health_physician' then 'medico'::health.staff_role
      when 'health_nursing' then 'enfermeria'::health.staff_role
      when 'health_pharmacy' then 'farmacia'::health.staff_role
      when 'health_auditor' then 'auditoria'::health.staff_role
    end;

    insert into health.staff_profiles (
      auth_user_id, facility_id, role, full_name, active
    ) values (
      target_user_id, facility_id_value, health_role_value, left(trim(target_full_name), 220), true
    )
    on conflict (auth_user_id) do update set
      facility_id = excluded.facility_id,
      role = excluded.role,
      full_name = excluded.full_name,
      active = true,
      updated_at = now();
  end if;

  insert into access_control.audit_events (
    actor_user_id, operation, target_user_id, role_code, scope_type, scope_id,
    detail
  ) values (
    actor_user_id, 'role_assigned', target_user_id, target_role.code,
    normalized_scope_type, target_scope_id,
    jsonb_build_object('scopeLabel', target_scope_label, 'jobTitle', target_job_title)
  );

  return jsonb_build_object('userId', target_user_id, 'role', target_role.code, 'assigned', true);
end;
$$;

create function public.access_bootstrap_super_admin(
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
  super_role_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Operación exclusiva del servidor.' using errcode = '42501';
  end if;
  if exists (
    select 1 from access_control.user_role_assignments assignment
    join access_control.roles role on role.id = assignment.role_id
    where role.code = 'super_admin' and assignment.active
  ) then
    raise exception 'La cuenta superadministradora ya fue configurada.';
  end if;
  if not exists (
    select 1 from auth.users
    where id = target_user_id and lower(email) = lower(trim(target_email))
  ) then
    raise exception 'La identidad indicada no existe en Supabase Auth.';
  end if;

  insert into access_control.user_profiles (id, email, full_name, job_title, active)
  values (target_user_id, lower(trim(target_email)), left(trim(target_full_name), 220), 'Superadministrador', true)
  on conflict (id) do update set
    email = excluded.email, full_name = excluded.full_name,
    job_title = excluded.job_title, active = true, updated_at = now();

  select id into super_role_id from access_control.roles where code = 'super_admin';
  insert into access_control.user_role_assignments (
    user_id, role_id, scope_type, assigned_by
  ) values (target_user_id, super_role_id, 'global', null);

  insert into access_control.audit_events (
    operation, target_user_id, role_code, scope_type, detail
  ) values (
    'super_admin_bootstrapped', target_user_id, 'super_admin', 'global',
    jsonb_build_object('fullName', target_full_name)
  );

  return jsonb_build_object('userId', target_user_id, 'role', 'super_admin', 'configured', true);
end;
$$;

alter table health.patients
  add column registered_by_user_id uuid references auth.users(id) on delete set null,
  add column registration_source varchar(40) not null default 'hospital';

create index patients_registered_by_idx on health.patients (registered_by_user_id)
  where registered_by_user_id is not null;

create function public.health_register_patient(
  patient_document_type text,
  patient_document_number text,
  patient_full_name text,
  patient_birth_date date default null,
  patient_sex text default null,
  patient_phone text default null,
  patient_address text default null,
  patient_emergency_contact jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  facility_id_value uuid;
  existing_patient health.patients%rowtype;
  patient_record health.patients%rowtype;
begin
  if not (select access_control.has_permission('health.patients.register')) then
    raise exception 'No tienes permiso para registrar pacientes.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Se requiere verificación en dos pasos.' using errcode = '42501';
  end if;
  if length(trim(coalesce(patient_document_number, ''))) < 4
    or length(trim(coalesce(patient_full_name, ''))) < 5 then
    raise exception 'Documento y nombre completo son obligatorios.';
  end if;

  select id into facility_id_value from health.facilities
  where code = 'HMC4C' and active limit 1;

  select * into existing_patient
  from health.patients
  where facility_id = facility_id_value
    and document_type = upper(left(trim(coalesce(patient_document_type, 'CI')), 24))
    and document_number = regexp_replace(trim(patient_document_number), '\s+', '', 'g')
    and active
  limit 1;

  if found then
    return jsonb_build_object(
      'id', existing_patient.id,
      'clinicalNumber', existing_patient.clinical_number,
      'fullName', existing_patient.full_name,
      'documentNumber', existing_patient.document_number,
      'alreadyRegistered', true
    );
  end if;

  insert into health.patients (
    facility_id, document_type, document_number, full_name, birth_date,
    sex, phone, address, emergency_contact, registered_by_user_id,
    registration_source
  ) values (
    facility_id_value,
    upper(left(trim(coalesce(patient_document_type, 'CI')), 24)),
    left(regexp_replace(trim(patient_document_number), '\s+', '', 'g'), 40),
    left(trim(patient_full_name), 220), patient_birth_date,
    nullif(left(trim(coalesce(patient_sex, '')), 24), ''),
    nullif(left(trim(coalesce(patient_phone, '')), 40), ''),
    nullif(trim(coalesce(patient_address, '')), ''), patient_emergency_contact,
    auth.uid(), 'hospital_admission'
  ) returning * into patient_record;

  return jsonb_build_object(
    'id', patient_record.id,
    'clinicalNumber', patient_record.clinical_number,
    'fullName', patient_record.full_name,
    'documentNumber', patient_record.document_number,
    'alreadyRegistered', false
  );
end;
$$;

create function public.health_search_patients(patient_query text, result_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  normalized_query text := trim(coalesce(patient_query, ''));
begin
  if not (select access_control.has_permission('health.patients.read')) then
    raise exception 'No tienes permiso para consultar pacientes.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Se requiere verificación en dos pasos.' using errcode = '42501';
  end if;
  if length(normalized_query) < 3 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', patient.id,
      'clinicalNumber', patient.clinical_number,
      'documentType', patient.document_type,
      'documentNumber', patient.document_number,
      'fullName', patient.full_name,
      'birthDate', patient.birth_date,
      'phone', patient.phone
    ) order by patient.full_name)
    from (
      select * from health.patients
      where active and (
        document_number ilike '%' || normalized_query || '%'
        or full_name ilike '%' || normalized_query || '%'
        or clinical_number::text = normalized_query
      )
      order by full_name
      limit least(greatest(result_limit, 1), 50)
    ) patient
  ), '[]'::jsonb);
end;
$$;

-- Las políticas clínicas pasan a usar permisos centralizados.
drop policy if exists staff_read_facilities on health.facilities;
drop policy if exists staff_read_specialties on health.specialties;
drop policy if exists staff_read_profiles on health.staff_profiles;
drop policy if exists staff_read_patients on health.patients;
drop policy if exists staff_write_patients on health.patients;
drop policy if exists staff_read_slots on health.appointment_slots;
drop policy if exists staff_read_appointments on health.appointments;
drop policy if exists staff_write_appointments on health.appointments;
drop policy if exists administrators_read_audit on health.audit_events;

create policy access_read_facilities on health.facilities
for select to authenticated using (
  (select access_control.has_permission('health.appointments.read'))
  or (select access_control.has_permission('health.users.manage'))
);
create policy access_read_specialties on health.specialties
for select to authenticated using (
  (select access_control.has_permission('health.appointments.read'))
  or (select access_control.has_permission('health.users.manage'))
);
create policy access_read_staff_profiles on health.staff_profiles
for select to authenticated using (
  auth_user_id = (select auth.uid())
  or (select access_control.has_permission('health.users.manage'))
);
create policy access_read_patients on health.patients
for select to authenticated using (
  (select access_control.has_permission('health.patients.read'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);
create policy access_insert_patients on health.patients
for insert to authenticated with check (
  (select access_control.has_permission('health.patients.register'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);
create policy access_update_patients on health.patients
for update to authenticated
using (
  (select access_control.has_permission('health.patients.register'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
)
with check (
  (select access_control.has_permission('health.patients.register'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);
create policy access_read_slots on health.appointment_slots
for select to authenticated using (
  (select access_control.has_permission('health.appointments.read'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);
create policy access_read_appointments on health.appointments
for select to authenticated using (
  (select access_control.has_permission('health.appointments.read'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);
create policy access_write_appointments on health.appointments
for all to authenticated
using (
  (select access_control.has_permission('health.appointments.manage'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
)
with check (
  (select access_control.has_permission('health.appointments.manage'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clinical_encounters', 'clinical_notes', 'vital_signs', 'diagnoses',
    'allergies', 'prescriptions', 'prescription_items', 'clinical_documents', 'consents'
  ] loop
    execute format('drop policy if exists clinical_staff_read on health.%I', table_name);
    execute format('drop policy if exists clinical_staff_write on health.%I', table_name);
    execute format(
      'create policy access_clinical_read on health.%I for select to authenticated using ((select access_control.has_permission(''health.clinical.read'')) and (select auth.jwt()->>''aal'' = ''aal2''))',
      table_name
    );
    execute format(
      'create policy access_clinical_write on health.%I for all to authenticated using ((select access_control.has_permission(''health.clinical.write'')) and (select auth.jwt()->>''aal'' = ''aal2'')) with check ((select access_control.has_permission(''health.clinical.write'')) and (select auth.jwt()->>''aal'' = ''aal2''))',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists access_clinical_read on health.prescriptions;
drop policy if exists access_clinical_write on health.prescriptions;
drop policy if exists access_clinical_read on health.prescription_items;
drop policy if exists access_clinical_write on health.prescription_items;

create policy access_prescriptions_read on health.prescriptions
for select to authenticated using (
  (
    (select access_control.has_permission('health.clinical.read'))
    or (select access_control.has_permission('health.prescriptions.read'))
  )
  and (select auth.jwt() ->> 'aal' = 'aal2')
);
create policy access_prescriptions_write on health.prescriptions
for all to authenticated
using (
  (select access_control.has_permission('health.prescriptions.write'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
)
with check (
  (select access_control.has_permission('health.prescriptions.write'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);
create policy access_prescription_items_read on health.prescription_items
for select to authenticated using (
  (
    (select access_control.has_permission('health.clinical.read'))
    or (select access_control.has_permission('health.prescriptions.read'))
  )
  and (select auth.jwt() ->> 'aal' = 'aal2')
);
create policy access_prescription_items_write on health.prescription_items
for all to authenticated
using (
  (select access_control.has_permission('health.prescriptions.write'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
)
with check (
  (select access_control.has_permission('health.prescriptions.write'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);

create policy access_read_health_audit on health.audit_events
for select to authenticated using (
  (select access_control.has_permission('health.audit.read'))
  and (select auth.jwt() ->> 'aal' = 'aal2')
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_profiles', 'roles', 'permissions', 'role_permissions',
    'user_role_assignments', 'audit_events'
  ] loop
    execute format('alter table access_control.%I enable row level security', table_name);
    execute format('alter table access_control.%I force row level security', table_name);
  end loop;
end;
$$;

revoke all on all tables in schema access_control from public, anon, authenticated;
revoke all on all sequences in schema access_control from public, anon, authenticated;
grant all on all tables in schema access_control to service_role;
grant all on all sequences in schema access_control to service_role;

revoke all on function access_control.set_updated_at() from public, anon, authenticated;
revoke all on function access_control.prevent_audit_changes() from public, anon, authenticated;
revoke all on function access_control.has_permission(text, access_control.scope_type, uuid) from public, anon, authenticated;
revoke all on function access_control.has_role(text) from public, anon, authenticated;
revoke all on function access_control.can_assign_role(text) from public, anon, authenticated;
revoke all on function access_control.handle_new_auth_user() from public, anon, authenticated;

revoke all on function public.access_my_context() from public, anon;
revoke all on function public.access_roles_catalog() from public, anon;
revoke all on function public.access_list_users() from public, anon;
revoke all on function public.access_register_invited_user(uuid, text, text, text, text, uuid, text, text) from public, anon;
revoke all on function public.access_bootstrap_super_admin(uuid, text, text) from public, anon, authenticated;
revoke all on function public.health_register_patient(text, text, text, date, text, text, text, jsonb) from public, anon;
revoke all on function public.health_search_patients(text, integer) from public, anon;

grant execute on function public.access_my_context() to authenticated, service_role;
grant execute on function public.access_roles_catalog() to authenticated, service_role;
grant execute on function public.access_list_users() to authenticated, service_role;
grant execute on function public.access_register_invited_user(uuid, text, text, text, text, uuid, text, text) to authenticated, service_role;
grant execute on function public.access_bootstrap_super_admin(uuid, text, text) to service_role;
grant execute on function public.health_register_patient(text, text, text, date, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.health_search_patients(text, integer) to authenticated, service_role;

alter default privileges in schema access_control revoke all on tables from public, anon, authenticated;
alter default privileges in schema access_control revoke all on sequences from public, anon, authenticated;
alter default privileges in schema access_control grant all on tables to service_role;
alter default privileges in schema access_control grant all on sequences to service_role;

comment on schema access_control is 'Identidades, roles, permisos y ámbitos de SIGEM y Salud.';
comment on function public.access_bootstrap_super_admin(uuid, text, text) is
  'Inicializa una sola cuenta superadministradora; exclusiva del servidor.';
