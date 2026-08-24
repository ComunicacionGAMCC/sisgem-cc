-- Base exclusiva de salud del Hospital Municipal de Cuatro Cañadas.
-- El esquema health no se expone mediante la Data API; el portal público accede
-- únicamente a través de endpoints de servidor controlados por SIGEM.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists health;
revoke all on schema health from public, anon;
grant usage on schema health to authenticated, service_role;

create type health.appointment_status as enum (
  'reservada', 'confirmada', 'atendida', 'ausente', 'cancelada'
);

create type health.staff_role as enum (
  'administrador_salud', 'admision', 'medico', 'enfermeria', 'farmacia', 'auditoria'
);

create type health.note_status as enum ('borrador', 'firmada', 'anulada');

create table health.facilities (
  id uuid primary key default gen_random_uuid(),
  code varchar(24) not null unique,
  name varchar(180) not null,
  municipality varchar(120) not null default 'Cuatro Cañadas',
  department varchar(120) not null default 'Santa Cruz',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table health.specialties (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references health.facilities(id) on delete restrict,
  code varchar(24) not null,
  name varchar(140) not null,
  description text,
  duration_minutes integer not null default 15 check (duration_minutes between 5 and 120),
  default_daily_capacity integer not null default 20 check (default_daily_capacity between 1 and 300),
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, code)
);

create index specialties_active_order_idx
  on health.specialties (facility_id, display_order)
  where active;

create table health.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  facility_id uuid not null references health.facilities(id) on delete restrict,
  role health.staff_role not null,
  full_name varchar(220) not null,
  professional_registration varchar(80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_profiles_facility_role_idx
  on health.staff_profiles (facility_id, role)
  where active;

create table health.patients (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references health.facilities(id) on delete restrict,
  clinical_number bigint generated always as identity,
  document_type varchar(24) not null default 'CI',
  document_number varchar(40) not null,
  full_name varchar(220) not null,
  birth_date date,
  sex varchar(24),
  phone varchar(40),
  address text,
  emergency_contact jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, clinical_number),
  unique (facility_id, document_type, document_number)
);

create index patients_name_idx on health.patients (facility_id, full_name);

create table health.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references health.specialties(id) on delete restrict,
  appointment_date date not null,
  start_time time(0) not null default '07:00:00',
  total_capacity integer not null check (total_capacity between 1 and 300),
  reserved_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (specialty_id, appointment_date),
  check (reserved_count between 0 and total_capacity)
);

create index appointment_slots_available_idx
  on health.appointment_slots (appointment_date, specialty_id)
  where active;

create table health.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id varchar(64) not null unique,
  code varchar(40) not null unique,
  facility_id uuid not null references health.facilities(id) on delete restrict,
  specialty_id uuid not null references health.specialties(id) on delete restrict,
  slot_id uuid not null references health.appointment_slots(id) on delete restrict,
  patient_id uuid references health.patients(id) on delete restrict,
  patient_name varchar(220) not null,
  document_number varchar(40) not null,
  phone varchar(40) not null,
  birth_date date,
  appointment_date date not null,
  estimated_time time(0) not null,
  turn_number integer not null check (turn_number > 0),
  status health.appointment_status not null default 'reservada',
  consent_granted boolean not null check (consent_granted),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, turn_number)
);

create index appointments_date_status_idx
  on health.appointments (appointment_date, status);
create index appointments_specialty_date_idx
  on health.appointments (specialty_id, appointment_date);
create index appointments_document_idx
  on health.appointments (facility_id, document_number);
create index appointments_patient_idx
  on health.appointments (patient_id)
  where patient_id is not null;

create table health.clinical_encounters (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references health.facilities(id) on delete restrict,
  patient_id uuid not null references health.patients(id) on delete restrict,
  appointment_id uuid references health.appointments(id) on delete set null,
  attending_staff_id uuid not null references health.staff_profiles(id) on delete restrict,
  encounter_type varchar(40) not null default 'consulta_externa',
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index clinical_encounters_patient_date_idx
  on health.clinical_encounters (patient_id, started_at desc);
create index clinical_encounters_staff_date_idx
  on health.clinical_encounters (attending_staff_id, started_at desc);
create index clinical_encounters_appointment_idx
  on health.clinical_encounters (appointment_id)
  where appointment_id is not null;

create table health.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references health.clinical_encounters(id) on delete restrict,
  author_staff_id uuid not null references health.staff_profiles(id) on delete restrict,
  note_type varchar(40) not null default 'evolucion',
  content text not null,
  status health.note_status not null default 'borrador',
  signed_at timestamptz,
  supersedes_note_id uuid references health.clinical_notes(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'firmada' and signed_at is not null) or status <> 'firmada')
);

create index clinical_notes_encounter_date_idx
  on health.clinical_notes (encounter_id, created_at desc);
create index clinical_notes_author_idx on health.clinical_notes (author_staff_id);

create table health.vital_signs (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references health.clinical_encounters(id) on delete cascade,
  recorded_by_staff_id uuid not null references health.staff_profiles(id) on delete restrict,
  temperature_c numeric(4,1),
  systolic_bp smallint,
  diastolic_bp smallint,
  heart_rate smallint,
  respiratory_rate smallint,
  oxygen_saturation numeric(5,2),
  weight_kg numeric(6,2),
  height_cm numeric(5,1),
  recorded_at timestamptz not null default now(),
  check (temperature_c is null or temperature_c between 25 and 50),
  check (oxygen_saturation is null or oxygen_saturation between 0 and 100)
);

create index vital_signs_encounter_date_idx
  on health.vital_signs (encounter_id, recorded_at desc);

create table health.diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references health.clinical_encounters(id) on delete cascade,
  diagnosed_by_staff_id uuid not null references health.staff_profiles(id) on delete restrict,
  icd10_code varchar(16),
  description text not null,
  diagnosis_type varchar(24) not null default 'presuntivo',
  created_at timestamptz not null default now()
);

create index diagnoses_encounter_idx on health.diagnoses (encounter_id);
create index diagnoses_icd10_idx on health.diagnoses (icd10_code)
  where icd10_code is not null;

create table health.allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references health.patients(id) on delete cascade,
  recorded_by_staff_id uuid not null references health.staff_profiles(id) on delete restrict,
  substance varchar(180) not null,
  reaction text,
  severity varchar(24),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index allergies_patient_active_idx on health.allergies (patient_id) where active;

create table health.prescriptions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references health.clinical_encounters(id) on delete restrict,
  prescriber_staff_id uuid not null references health.staff_profiles(id) on delete restrict,
  instructions text,
  issued_at timestamptz not null default now(),
  valid_until date,
  status varchar(24) not null default 'activa',
  created_at timestamptz not null default now()
);

create index prescriptions_encounter_idx on health.prescriptions (encounter_id);

create table health.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references health.prescriptions(id) on delete cascade,
  medication varchar(220) not null,
  concentration varchar(100),
  dose varchar(120) not null,
  route varchar(80),
  frequency varchar(120) not null,
  duration varchar(120),
  quantity varchar(80),
  instructions text
);

create index prescription_items_prescription_idx
  on health.prescription_items (prescription_id);

create table health.clinical_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references health.patients(id) on delete restrict,
  encounter_id uuid references health.clinical_encounters(id) on delete set null,
  uploaded_by_staff_id uuid not null references health.staff_profiles(id) on delete restrict,
  storage_bucket varchar(80) not null,
  storage_path text not null unique,
  document_type varchar(80) not null,
  mime_type varchar(120) not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 varchar(64),
  created_at timestamptz not null default now()
);

create index clinical_documents_patient_date_idx
  on health.clinical_documents (patient_id, created_at desc);
create index clinical_documents_encounter_idx
  on health.clinical_documents (encounter_id)
  where encounter_id is not null;

create table health.consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references health.patients(id) on delete restrict,
  consent_type varchar(80) not null,
  version varchar(24) not null,
  granted boolean not null,
  evidence jsonb,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  recorded_by_staff_id uuid references health.staff_profiles(id) on delete restrict,
  check (revoked_at is null or revoked_at >= granted_at)
);

create index consents_patient_type_idx
  on health.consents (patient_id, consent_type, granted_at desc);

create table health.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_role text not null default current_user,
  operation varchar(12) not null,
  table_name varchar(80) not null,
  record_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index audit_events_record_idx
  on health.audit_events (table_name, record_id, occurred_at desc);
create index audit_events_actor_date_idx
  on health.audit_events (actor_user_id, occurred_at desc)
  where actor_user_id is not null;

create function health.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function health.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, health
as $$
declare
  affected_id uuid;
begin
  affected_id := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into health.audit_events (
    actor_user_id, operation, table_name, record_id, request_id
  ) values (
    auth.uid(), tg_op, tg_table_name, affected_id,
    nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', '')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function health.protect_signed_note()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status = 'firmada' and (
    new.content is distinct from old.content or
    new.author_staff_id is distinct from old.author_staff_id or
    new.encounter_id is distinct from old.encounter_id or
    new.signed_at is distinct from old.signed_at
  ) then
    raise exception 'Una nota clínica firmada no puede modificarse; cree una nota de corrección.';
  end if;
  return new;
end;
$$;

create function health.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, health
as $$
  select exists (
    select 1 from health.staff_profiles
    where auth_user_id = auth.uid() and active
  );
$$;

create function health.has_staff_role(allowed_roles health.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, health
as $$
  select exists (
    select 1 from health.staff_profiles
    where auth_user_id = auth.uid() and active and role = any(allowed_roles)
  );
$$;

revoke all on function health.set_updated_at() from public, anon, authenticated;
revoke all on function health.record_audit_event() from public, anon, authenticated;
revoke all on function health.protect_signed_note() from public, anon, authenticated;
revoke all on function health.is_active_staff() from public, anon;
revoke all on function health.has_staff_role(health.staff_role[]) from public, anon;
grant execute on function health.is_active_staff() to authenticated, service_role;
grant execute on function health.has_staff_role(health.staff_role[]) to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'facilities', 'specialties', 'staff_profiles', 'patients',
    'appointment_slots', 'appointments', 'clinical_encounters', 'clinical_notes',
    'allergies'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on health.%I for each row execute function health.set_updated_at()',
      table_name, table_name
    );
  end loop;

  foreach table_name in array array[
    'facilities', 'specialties', 'staff_profiles', 'patients',
    'appointment_slots', 'appointments', 'clinical_encounters', 'clinical_notes',
    'vital_signs', 'diagnoses', 'allergies', 'prescriptions',
    'prescription_items', 'clinical_documents', 'consents'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on health.%I for each row execute function health.record_audit_event()',
      table_name, table_name
    );
  end loop;
end;
$$;

create trigger clinical_notes_protect_signed
before update on health.clinical_notes
for each row execute function health.protect_signed_note();

create function health.prevent_audit_changes()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Los eventos de auditoría son inmutables.';
end;
$$;

revoke all on function health.prevent_audit_changes() from public, anon, authenticated;
create trigger audit_events_immutable
before update or delete on health.audit_events
for each row execute function health.prevent_audit_changes();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'facilities', 'specialties', 'staff_profiles', 'patients',
    'appointment_slots', 'appointments', 'clinical_encounters', 'clinical_notes',
    'vital_signs', 'diagnoses', 'allergies', 'prescriptions',
    'prescription_items', 'clinical_documents', 'consents', 'audit_events'
  ] loop
    execute format('alter table health.%I enable row level security', table_name);
    execute format('alter table health.%I force row level security', table_name);
  end loop;
end;
$$;

revoke all on all tables in schema health from public, anon, authenticated;
revoke all on all sequences in schema health from public, anon, authenticated;
grant all on all tables in schema health to service_role;
grant all on all sequences in schema health to service_role;

grant select on health.facilities, health.specialties, health.staff_profiles,
  health.patients, health.appointment_slots, health.appointments,
  health.clinical_encounters, health.clinical_notes, health.vital_signs,
  health.diagnoses, health.allergies, health.prescriptions,
  health.prescription_items, health.clinical_documents, health.consents
to authenticated;

grant insert, update on health.patients, health.appointments,
  health.clinical_encounters, health.clinical_notes, health.vital_signs,
  health.diagnoses, health.allergies, health.prescriptions,
  health.prescription_items, health.clinical_documents, health.consents
to authenticated;

create policy staff_read_facilities on health.facilities
for select to authenticated using ((select health.is_active_staff()));
create policy staff_read_specialties on health.specialties
for select to authenticated using ((select health.is_active_staff()));
create policy staff_read_profiles on health.staff_profiles
for select to authenticated using ((select health.is_active_staff()));
create policy staff_read_patients on health.patients
for select to authenticated using ((select health.is_active_staff()));
create policy staff_write_patients on health.patients
for all to authenticated
using ((select health.has_staff_role(array['administrador_salud','admision','medico','enfermeria']::health.staff_role[])))
with check ((select health.has_staff_role(array['administrador_salud','admision','medico','enfermeria']::health.staff_role[])));
create policy staff_read_slots on health.appointment_slots
for select to authenticated using ((select health.is_active_staff()));
create policy staff_read_appointments on health.appointments
for select to authenticated using ((select health.is_active_staff()));
create policy staff_write_appointments on health.appointments
for all to authenticated
using ((select health.has_staff_role(array['administrador_salud','admision','medico','enfermeria']::health.staff_role[])))
with check ((select health.has_staff_role(array['administrador_salud','admision','medico','enfermeria']::health.staff_role[])));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clinical_encounters', 'clinical_notes', 'vital_signs', 'diagnoses',
    'allergies', 'prescriptions', 'prescription_items', 'clinical_documents', 'consents'
  ] loop
    execute format(
      'create policy clinical_staff_read on health.%I for select to authenticated using ((select health.has_staff_role(array[''administrador_salud'',''medico'',''enfermeria'',''farmacia'',''auditoria'']::health.staff_role[])) and (select auth.jwt()->>''aal'' = ''aal2''))',
      table_name
    );
    execute format(
      'create policy clinical_staff_write on health.%I for all to authenticated using ((select health.has_staff_role(array[''administrador_salud'',''medico'',''enfermeria'']::health.staff_role[])) and (select auth.jwt()->>''aal'' = ''aal2'')) with check ((select health.has_staff_role(array[''administrador_salud'',''medico'',''enfermeria'']::health.staff_role[])) and (select auth.jwt()->>''aal'' = ''aal2''))',
      table_name
    );
  end loop;
end;
$$;

create policy administrators_read_audit on health.audit_events
for select to authenticated
using (
  (select health.has_staff_role(array['administrador_salud','auditoria']::health.staff_role[]))
  and (select auth.jwt()->>'aal' = 'aal2')
);

alter default privileges in schema health revoke all on tables from public, anon, authenticated;
alter default privileges in schema health revoke all on sequences from public, anon, authenticated;
alter default privileges in schema health grant all on tables to service_role;
alter default privileges in schema health grant all on sequences to service_role;

insert into health.facilities (code, name)
values ('HMC4C', 'Hospital Municipal de Cuatro Cañadas')
on conflict (code) do update set name = excluded.name, updated_at = now();

insert into health.specialties (
  facility_id, code, name, description, duration_minutes,
  default_daily_capacity, display_order
)
select f.id, values_list.code, values_list.name, values_list.description,
       values_list.duration_minutes, values_list.capacity, values_list.display_order
from health.facilities f
cross join (values
  ('MED-GEN', 'Medicina General', 'Consulta médica general para pacientes adultos y evaluación inicial.', 15, 28, 1),
  ('PED', 'Pediatría', 'Atención para niñas, niños y adolescentes.', 20, 20, 2),
  ('GIN', 'Ginecología', 'Consulta y control integral de la salud de la mujer.', 20, 18, 3),
  ('ODO', 'Odontología', 'Valoración y atención odontológica programada.', 20, 18, 4)
) as values_list(code, name, description, duration_minutes, capacity, display_order)
where f.code = 'HMC4C'
on conflict (facility_id, code) do update set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  default_daily_capacity = excluded.default_daily_capacity,
  display_order = excluded.display_order,
  updated_at = now();

with business_days as (
  select day::date as appointment_date
  from generate_series(current_date + 1, current_date + 40, interval '1 day') day
  where extract(isodow from day) between 1 and 5
  order by day
  limit 15
)
insert into health.appointment_slots (
  specialty_id, appointment_date, total_capacity
)
select s.id, d.appointment_date, s.default_daily_capacity
from health.specialties s
cross join business_days d
where s.active
on conflict (specialty_id, appointment_date) do nothing;
