create function public.access_manage_user(
  target_user_id uuid,
  target_email text,
  target_full_name text,
  target_job_title text,
  target_active boolean,
  target_role_code text,
  target_scope_type text default 'global',
  target_scope_id uuid default null,
  target_scope_label text default null
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
  target_is_super_admin boolean;
  facility_id_value uuid;
  health_role_value health.staff_role;
begin
  if actor_user_id is null or not (select access_control.has_role('super_admin')) then
    raise exception 'Operación exclusiva de superadministración.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Se requiere verificación en dos pasos.' using errcode = '42501';
  end if;
  if target_user_id is null or trim(coalesce(target_email, '')) = ''
    or length(trim(coalesce(target_full_name, ''))) < 5 then
    raise exception 'El usuario, correo y nombre completo son obligatorios.' using errcode = '22023';
  end if;
  if target_user_id = actor_user_id and not target_active then
    raise exception 'No puedes desactivar tu propia cuenta.' using errcode = '42501';
  end if;

  perform 1 from access_control.user_profiles where id = target_user_id for update;
  if not found then raise exception 'El usuario indicado no existe.'; end if;

  select exists (
    select 1
    from access_control.user_role_assignments assignment
    join access_control.roles role on role.id = assignment.role_id
    where assignment.user_id = target_user_id and assignment.active
      and role.code = 'super_admin'
  ) into target_is_super_admin;

  if target_is_super_admin and (not target_active or target_role_code <> 'super_admin') then
    raise exception 'Las cuentas superadministradoras deben conservar su rol y permanecer activas.' using errcode = '42501';
  end if;

  select * into target_role
  from access_control.roles
  where code = target_role_code and active;
  if not found or not (select access_control.can_assign_role(target_role_code)) then
    raise exception 'No puedes asignar el tipo de acceso seleccionado.' using errcode = '42501';
  end if;

  begin
    normalized_scope_type := target_scope_type::access_control.scope_type;
  exception when invalid_text_representation then
    raise exception 'El ámbito seleccionado no es válido.';
  end;

  if normalized_scope_type = 'global' and target_scope_id is not null then
    raise exception 'El ámbito global no acepta un área específica.';
  end if;
  if normalized_scope_type <> 'global' and target_scope_id is null then
    raise exception 'Selecciona el área correspondiente.';
  end if;
  if target_role.module = 'health' and normalized_scope_type not in ('global', 'facility') then
    raise exception 'Los roles de Salud solo aceptan ámbito hospitalario.';
  end if;
  if target_role.module = 'sigem' and normalized_scope_type = 'facility' then
    raise exception 'Los roles SIGEM no aceptan ámbito hospitalario.';
  end if;
  if not exists (
    select 1 from auth.users
    where id = target_user_id and lower(email) = lower(trim(target_email))
  ) then
    raise exception 'La identidad no coincide con Supabase Auth.';
  end if;

  update access_control.user_profiles
  set email = lower(trim(target_email)),
      full_name = left(trim(target_full_name), 220),
      job_title = nullif(left(trim(coalesce(target_job_title, '')), 180), ''),
      active = target_active,
      updated_at = now()
  where id = target_user_id;

  update access_control.user_role_assignments
  set active = false, valid_until = now(), updated_at = now()
  where user_id = target_user_id and active;

  insert into access_control.user_role_assignments (
    user_id, role_id, scope_type, scope_id, scope_label, active, assigned_by
  ) values (
    target_user_id, target_role.id, normalized_scope_type, target_scope_id,
    nullif(left(trim(coalesce(target_scope_label, '')), 180), ''), true, actor_user_id
  );

  update health.staff_profiles
  set active = false, updated_at = now()
  where auth_user_id = target_user_id;

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
      target_user_id, facility_id_value, health_role_value,
      left(trim(target_full_name), 220), target_active
    )
    on conflict (auth_user_id) do update set
      facility_id = excluded.facility_id,
      role = excluded.role,
      full_name = excluded.full_name,
      active = excluded.active,
      updated_at = now();
  end if;

  insert into access_control.audit_events (
    actor_user_id, operation, target_user_id, role_code, scope_type, scope_id, detail
  ) values (
    actor_user_id,
    case when target_active then 'user_updated' else 'user_deactivated' end,
    target_user_id, target_role.code, normalized_scope_type, target_scope_id,
    jsonb_build_object(
      'email', lower(trim(target_email)),
      'fullName', left(trim(target_full_name), 220),
      'jobTitle', target_job_title,
      'active', target_active,
      'scopeLabel', target_scope_label
    )
  );

  return jsonb_build_object(
    'userId', target_user_id,
    'role', target_role.code,
    'active', target_active,
    'updated', true
  );
end;
$$;

create function public.access_record_password_change(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or not (select access_control.has_role('super_admin')) then
    raise exception 'Operación exclusiva de superadministración.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Se requiere verificación en dos pasos.' using errcode = '42501';
  end if;
  if not exists (select 1 from access_control.user_profiles where id = target_user_id) then
    raise exception 'El usuario indicado no existe.';
  end if;

  insert into access_control.audit_events (
    actor_user_id, operation, target_user_id, detail
  ) values (
    auth.uid(), 'password_changed_by_admin', target_user_id,
    jsonb_build_object('method', 'direct_admin_assignment')
  );
end;
$$;

revoke all on function public.access_manage_user(uuid, text, text, text, boolean, text, text, uuid, text)
  from public, anon;
revoke all on function public.access_record_password_change(uuid)
  from public, anon;
grant execute on function public.access_manage_user(uuid, text, text, text, boolean, text, text, uuid, text)
  to authenticated, service_role;
grant execute on function public.access_record_password_change(uuid)
  to authenticated, service_role;
