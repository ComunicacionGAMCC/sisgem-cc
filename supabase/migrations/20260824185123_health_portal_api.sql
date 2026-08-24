-- API mínima para el portal público. Las tablas de health permanecen fuera de
-- la Data API; solo estas funciones, ejecutadas con la clave secreta del
-- servidor, pueden consultar o emitir fichas.

create function public.health_portal_panel()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, health, public
as $$
declare
  hospital_name text;
  result jsonb;
begin
  insert into health.appointment_slots (specialty_id, appointment_date, total_capacity)
  select specialty.id, business_day.appointment_date, specialty.default_daily_capacity
  from health.specialties specialty
  cross join lateral (
    select day::date as appointment_date
    from generate_series(current_date + 1, current_date + 40, interval '1 day') day
    where extract(isodow from day) between 1 and 5
    order by day
    limit 15
  ) business_day
  where specialty.active
  on conflict (specialty_id, appointment_date) do nothing;

  select name into hospital_name
  from health.facilities
  where code = 'HMC4C' and active
  limit 1;

  if hospital_name is null then
    raise exception 'El Hospital Municipal no está configurado en la base de salud.';
  end if;

  select jsonb_build_object(
    'hospital', hospital_name,
    'summary', jsonb_build_object(
      'total', count(*)::integer,
      'hoy', count(*) filter (where appointment_date = current_date)::integer,
      'pendientes', count(*) filter (where status in ('reservada', 'confirmada'))::integer,
      'atendidas', count(*) filter (where status = 'atendida')::integer
    )
  ) into result
  from health.appointments;

  result := result || jsonb_build_object(
    'specialties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', specialty.id,
        'code', specialty.code,
        'name', specialty.name,
        'description', specialty.description,
        'durationMinutes', specialty.duration_minutes
      ) order by specialty.display_order)
      from health.specialties specialty
      where specialty.active
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', slot.id,
        'specialtyId', specialty.id,
        'specialtyCode', specialty.code,
        'specialty', specialty.name,
        'description', specialty.description,
        'durationMinutes', specialty.duration_minutes,
        'date', slot.appointment_date,
        'startTime', to_char(slot.start_time, 'HH24:MI'),
        'capacity', slot.total_capacity,
        'booked', slot.reserved_count,
        'available', greatest(slot.total_capacity - slot.reserved_count, 0)
      ) order by slot.appointment_date, specialty.display_order)
      from health.appointment_slots slot
      join health.specialties specialty on specialty.id = slot.specialty_id
      where slot.appointment_date >= current_date and slot.active and specialty.active
    ), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(item order by created_at desc)
      from (
        select jsonb_build_object(
          'id', appointment.id,
          'code', appointment.code,
          'patientName', appointment.patient_name,
          'document', appointment.document_number,
          'specialty', specialty.name,
          'date', appointment.appointment_date,
          'estimatedTime', to_char(appointment.estimated_time, 'HH24:MI'),
          'turn', appointment.turn_number,
          'state', appointment.status,
          'createdAt', appointment.created_at
        ) as item, appointment.created_at
        from health.appointments appointment
        join health.specialties specialty on specialty.id = appointment.specialty_id
        order by appointment.created_at desc
        limit 80
      ) recent
    ), '[]'::jsonb),
    'privacy', 'Los datos del paciente se muestran protegidos hasta implementar el acceso hospitalario autenticado.'
  );

  return result;
end;
$$;

create function public.health_create_appointment(
  p_request_id uuid,
  p_specialty_id uuid,
  p_slot_id uuid,
  p_patient_name text,
  p_document_number text,
  p_phone text,
  p_birth_date date,
  p_consent_granted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, health, public
as $$
declare
  existing_record record;
  slot_record record;
  specialty_record record;
  appointment_record record;
  estimated_time_value time(0);
begin
  if not p_consent_granted then
    raise exception 'Debes autorizar el uso de los datos para emitir la ficha.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select appointment.id, appointment.code, appointment.appointment_date,
         appointment.estimated_time, appointment.turn_number, appointment.status,
         specialty.name as specialty_name
  into existing_record
  from health.appointments appointment
  join health.specialties specialty on specialty.id = appointment.specialty_id
  where appointment.request_id = p_request_id::text;

  if found then
    return jsonb_build_object(
      'id', existing_record.id,
      'code', existing_record.code,
      'specialty', existing_record.specialty_name,
      'date', existing_record.appointment_date,
      'estimatedTime', to_char(existing_record.estimated_time, 'HH24:MI'),
      'turn', existing_record.turn_number,
      'status', initcap(existing_record.status::text),
      'hospital', 'Hospital Municipal de Cuatro Cañadas',
      'instructions', 'Presenta tu cédula y este código 30 minutos antes. El horario es estimado y puede variar por emergencias.'
    );
  end if;

  select specialty.id, specialty.facility_id, specialty.code, specialty.name,
         specialty.duration_minutes
  into specialty_record
  from health.specialties specialty
  where specialty.id = p_specialty_id and specialty.active;

  if not found then
    raise exception 'La especialidad seleccionada ya no está disponible.';
  end if;

  update health.appointment_slots slot
  set reserved_count = slot.reserved_count + 1,
      updated_at = now()
  where slot.id = p_slot_id
    and slot.specialty_id = p_specialty_id
    and slot.active
    and slot.appointment_date >= current_date
    and slot.reserved_count < slot.total_capacity
  returning slot.id, slot.appointment_date, slot.start_time, slot.reserved_count
  into slot_record;

  if not found then
    raise exception 'Los cupos de este día se agotaron. Selecciona otra fecha.';
  end if;

  estimated_time_value := (
    slot_record.start_time
    + specialty_record.duration_minutes * (slot_record.reserved_count - 1) * interval '1 minute'
  )::time(0);

  insert into health.appointments (
    request_id, code, facility_id, specialty_id, slot_id,
    patient_name, document_number, phone, birth_date,
    appointment_date, estimated_time, turn_number, status,
    consent_granted, consented_at
  ) values (
    p_request_id::text,
    'FM-' || replace(slot_record.appointment_date::text, '-', '') || '-'
      || specialty_record.code || '-' || lpad(slot_record.reserved_count::text, 3, '0'),
    specialty_record.facility_id, p_specialty_id, p_slot_id,
    left(trim(p_patient_name), 220), left(regexp_replace(p_document_number, '\s+', '', 'g'), 40),
    left(trim(p_phone), 40), p_birth_date,
    slot_record.appointment_date, estimated_time_value, slot_record.reserved_count,
    'reservada', true, now()
  )
  returning id, code, appointment_date, estimated_time, turn_number, status
  into appointment_record;

  return jsonb_build_object(
    'id', appointment_record.id,
    'code', appointment_record.code,
    'specialty', specialty_record.name,
    'date', appointment_record.appointment_date,
    'estimatedTime', to_char(appointment_record.estimated_time, 'HH24:MI'),
    'turn', appointment_record.turn_number,
    'status', 'Reservada',
    'hospital', 'Hospital Municipal de Cuatro Cañadas',
    'instructions', 'Presenta tu cédula y este código 30 minutos antes. El horario es estimado y puede variar por emergencias.'
  );
end;
$$;

revoke all on function public.health_portal_panel() from public, anon, authenticated;
revoke all on function public.health_create_appointment(uuid, uuid, uuid, text, text, text, date, boolean)
  from public, anon, authenticated;
grant execute on function public.health_portal_panel() to service_role;
grant execute on function public.health_create_appointment(uuid, uuid, uuid, text, text, text, date, boolean)
  to service_role;

comment on function public.health_portal_panel() is
  'Portal de fichas médicas: lectura controlada exclusiva del servidor SIGEM.';
comment on function public.health_create_appointment(uuid, uuid, uuid, text, text, text, date, boolean) is
  'Portal de fichas médicas: emisión atómica exclusiva del servidor SIGEM.';
