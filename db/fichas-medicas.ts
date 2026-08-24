import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./index";
import { cuposMedicos, especialidadesMedicas, fichasMedicas } from "./schema";

export type NuevaFichaMedica = {
  solicitudId: string;
  especialidadId: string;
  cupoId: string;
  nombrePaciente: string;
  documento: string;
  telefono: string;
  fechaNacimiento?: string;
  consentimiento: boolean;
};

const especialidadesBase = [
  {
    codigo: "MED-GEN",
    nombre: "Medicina General",
    descripcion: "Consulta médica general para pacientes adultos y evaluación inicial.",
    duracionMinutos: 15,
    cupoDiarioDefault: 28,
    orden: 1,
  },
  {
    codigo: "PED",
    nombre: "Pediatría",
    descripcion: "Atención para niñas, niños y adolescentes.",
    duracionMinutos: 20,
    cupoDiarioDefault: 20,
    orden: 2,
  },
  {
    codigo: "GIN",
    nombre: "Ginecología",
    descripcion: "Consulta y control integral de la salud de la mujer.",
    duracionMinutos: 20,
    cupoDiarioDefault: 18,
    orden: 3,
  },
  {
    codigo: "ODO",
    nombre: "Odontología",
    descripcion: "Valoración y atención odontológica programada.",
    duracionMinutos: 20,
    cupoDiarioDefault: 18,
    orden: 4,
  },
] as const;

const estadoEtiquetas = {
  reservada: "Reservada",
  confirmada: "Confirmada",
  atendida: "Atendida",
  ausente: "Ausente",
  cancelada: "Cancelada",
} as const;

function fechaBolivia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function proximosDiasHabiles(cantidad = 15) {
  const hoy = new Date(`${fechaBolivia()}T12:00:00Z`);
  const fechas: string[] = [];
  for (let avance = 1; fechas.length < cantidad && avance < 40; avance += 1) {
    const fecha = new Date(hoy);
    fecha.setUTCDate(hoy.getUTCDate() + avance);
    const dia = fecha.getUTCDay();
    if (dia !== 0 && dia !== 6) fechas.push(fecha.toISOString().slice(0, 10));
  }
  return fechas;
}

function ocultarNombre(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => `${parte[0]?.toUpperCase() ?? ""}${"•".repeat(Math.min(Math.max(parte.length - 1, 1), 6))}`)
    .join(" ");
}

function ocultarDocumento(documento: string) {
  const limpio = documento.trim();
  return `${"•".repeat(Math.max(limpio.length - 3, 3))}${limpio.slice(-3)}`;
}

async function asegurarConfiguracionBase() {
  const db = getDb();
  for (const especialidad of especialidadesBase) {
    await db
      .insert(especialidadesMedicas)
      .values(especialidad)
      .onConflictDoNothing({ target: especialidadesMedicas.codigo });
  }

  const especialidades = await db
    .select()
    .from(especialidadesMedicas)
    .where(eq(especialidadesMedicas.activa, true))
    .orderBy(asc(especialidadesMedicas.orden));

  const fechas = proximosDiasHabiles();
  if (especialidades.length && fechas.length) {
    await db
      .insert(cuposMedicos)
      .values(
        especialidades.flatMap((especialidad) =>
          fechas.map((fecha) => ({
            especialidadId: especialidad.id,
            fecha,
            cupoTotal: especialidad.cupoDiarioDefault,
          })),
        ),
      )
      .onConflictDoNothing({ target: [cuposMedicos.especialidadId, cuposMedicos.fecha] });
  }

  return especialidades;
}

export async function obtenerPanelFichasMedicas() {
  const db = getDb();
  const especialidades = await asegurarConfiguracionBase();
  const hoy = fechaBolivia();
  const [resumen] = await db
    .select({
      total: sql<number>`count(*)::int`,
      hoy: sql<number>`count(*) filter (where ${fichasMedicas.fechaAtencion} = ${hoy})::int`,
      pendientes: sql<number>`count(*) filter (where ${fichasMedicas.estado} in ('reservada', 'confirmada'))::int`,
      atendidas: sql<number>`count(*) filter (where ${fichasMedicas.estado} = 'atendida')::int`,
    })
    .from(fichasMedicas);

  const agenda = await db
    .select({
      id: cuposMedicos.id,
      specialtyId: especialidadesMedicas.id,
      specialtyCode: especialidadesMedicas.codigo,
      specialty: especialidadesMedicas.nombre,
      description: especialidadesMedicas.descripcion,
      durationMinutes: especialidadesMedicas.duracionMinutos,
      date: cuposMedicos.fecha,
      startTime: cuposMedicos.horaInicio,
      capacity: cuposMedicos.cupoTotal,
      booked: cuposMedicos.cuposReservados,
    })
    .from(cuposMedicos)
    .innerJoin(especialidadesMedicas, eq(cuposMedicos.especialidadId, especialidadesMedicas.id))
    .where(and(gte(cuposMedicos.fecha, hoy), eq(cuposMedicos.activo, true), eq(especialidadesMedicas.activa, true)))
    .orderBy(asc(cuposMedicos.fecha), asc(especialidadesMedicas.orden))
    .limit(120);

  const fichas = await db
    .select({
      id: fichasMedicas.id,
      code: fichasMedicas.codigo,
      patientName: fichasMedicas.nombrePaciente,
      document: fichasMedicas.documento,
      specialty: especialidadesMedicas.nombre,
      date: fichasMedicas.fechaAtencion,
      estimatedTime: fichasMedicas.horaEstimada,
      turn: fichasMedicas.numeroTurno,
      state: fichasMedicas.estado,
      createdAt: fichasMedicas.createdAt,
    })
    .from(fichasMedicas)
    .innerJoin(especialidadesMedicas, eq(fichasMedicas.especialidadId, especialidadesMedicas.id))
    .orderBy(desc(fichasMedicas.createdAt))
    .limit(80);

  return {
    hospital: "Hospital Municipal de Cuatro Cañadas",
    summary: resumen ?? { total: 0, hoy: 0, pendientes: 0, atendidas: 0 },
    specialties: especialidades.map((especialidad) => ({
      id: especialidad.id,
      code: especialidad.codigo,
      name: especialidad.nombre,
      description: especialidad.descripcion,
      durationMinutes: especialidad.duracionMinutos,
    })),
    availability: agenda.map((cupo) => ({
      ...cupo,
      available: Math.max(cupo.capacity - cupo.booked, 0),
      startTime: cupo.startTime.slice(0, 5),
    })),
    bookings: fichas.map((ficha) => ({
      ...ficha,
      patientName: ocultarNombre(ficha.patientName),
      document: ocultarDocumento(ficha.document),
      estimatedTime: ficha.estimatedTime.slice(0, 5),
      status: estadoEtiquetas[ficha.state],
      createdAt: ficha.createdAt.toISOString(),
    })),
    privacy: "Los datos del paciente se muestran protegidos hasta implementar el acceso hospitalario autenticado.",
  };
}

export async function crearFichaMedica(input: NuevaFichaMedica) {
  const db = getDb();
  await asegurarConfiguracionBase();

  const [cupo] = await db
    .select({
      id: cuposMedicos.id,
      specialtyId: cuposMedicos.especialidadId,
      specialty: especialidadesMedicas.nombre,
      specialtyCode: especialidadesMedicas.codigo,
      date: cuposMedicos.fecha,
      startTime: cuposMedicos.horaInicio,
      durationMinutes: especialidadesMedicas.duracionMinutos,
      capacity: cuposMedicos.cupoTotal,
      booked: cuposMedicos.cuposReservados,
      active: cuposMedicos.activo,
    })
    .from(cuposMedicos)
    .innerJoin(especialidadesMedicas, eq(cuposMedicos.especialidadId, especialidadesMedicas.id))
    .where(
      and(
        eq(cuposMedicos.id, input.cupoId),
        eq(cuposMedicos.especialidadId, input.especialidadId),
        eq(especialidadesMedicas.activa, true),
        eq(cuposMedicos.activo, true),
        gte(cuposMedicos.fecha, fechaBolivia()),
      ),
    )
    .limit(1);

  if (!cupo) throw new Error("El día o la especialidad seleccionada ya no están disponibles.");
  if (cupo.booked >= cupo.capacity) throw new Error("Los cupos de este día se agotaron. Selecciona otra fecha.");

  const resultado = await db.execute(sql`
    with bloqueo as (
      select pg_advisory_xact_lock(hashtextextended(${input.solicitudId}, 0))
    ), existente as (
      select fm.id, fm.codigo, fm.fecha_atencion, fm.hora_estimada, fm.numero_turno,
             fm.estado, em.nombre as especialidad
      from fichas_medicas fm
      inner join especialidades_medicas em on em.id = fm.especialidad_id
      cross join bloqueo
      where fm.solicitud_id = ${input.solicitudId}
    ), turno as (
      update cupos_medicos cm
      set cupos_reservados = cm.cupos_reservados + 1, updated_at = now()
      where cm.id = ${input.cupoId}
        and cm.especialidad_id = ${input.especialidadId}
        and cm.activo = true
        and cm.cupos_reservados < cm.cupo_total
        and not exists (select 1 from existente)
      returning cm.id, cm.especialidad_id, cm.fecha, cm.hora_inicio, cm.cupos_reservados
    ), insertada as (
      insert into fichas_medicas (
        solicitud_id, codigo, especialidad_id, cupo_id, nombre_paciente, documento,
        telefono, fecha_nacimiento, fecha_atencion, hora_estimada, numero_turno,
        estado, consentimiento, created_at, updated_at
      )
      select
        ${input.solicitudId},
        'FM-' || replace(t.fecha::text, '-', '') || '-' || ${cupo.specialtyCode} || '-' || lpad(t.cupos_reservados::text, 3, '0'),
        t.especialidad_id, t.id, ${input.nombrePaciente}, ${input.documento}, ${input.telefono},
        ${input.fechaNacimiento || null}::date, t.fecha,
        (t.hora_inicio + (${cupo.durationMinutes} * (t.cupos_reservados - 1)) * interval '1 minute')::time,
        t.cupos_reservados, 'reservada'::estado_ficha_medica, ${input.consentimiento}, now(), now()
      from turno t
      returning id, codigo, fecha_atencion, hora_estimada, numero_turno, estado
    )
    select i.id, i.codigo, i.fecha_atencion, i.hora_estimada, i.numero_turno, i.estado,
           ${cupo.specialty}::text as especialidad
    from insertada i
    union all
    select e.id, e.codigo, e.fecha_atencion, e.hora_estimada, e.numero_turno, e.estado, e.especialidad
    from existente e
    limit 1
  `);

  const filas = Array.isArray(resultado)
    ? (resultado as unknown as Array<Record<string, unknown>>)
    : ((resultado as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []);
  const ficha = filas[0];
  if (!ficha) throw new Error("Los cupos de este día acaban de agotarse. Selecciona otra fecha.");

  return {
    id: String(ficha.id),
    code: String(ficha.codigo),
    specialty: String(ficha.especialidad),
    date: String(ficha.fecha_atencion),
    estimatedTime: String(ficha.hora_estimada).slice(0, 5),
    turn: Number(ficha.numero_turno),
    status: estadoEtiquetas[String(ficha.estado) as keyof typeof estadoEtiquetas] ?? "Reservada",
    hospital: "Hospital Municipal de Cuatro Cañadas",
    instructions: "Presenta tu cédula y este código 30 minutos antes. El horario es estimado y puede variar por emergencias.",
  };
}
