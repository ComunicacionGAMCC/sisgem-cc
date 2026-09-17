import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "./index";
import { agendaActividades, auditoria } from "./schema";

export type AgendaActivity = {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  title: string;
  place: string | null;
  description: string | null;
  status: AgendaActivityStatus;
  attendance: AgendaAttendance;
  delegatePositionCode: string | null;
  delegatePositionName: string | null;
  delegateUnitName: string | null;
  decisionByName: string | null;
  decidedAt: string | null;
  createdByName: string | null;
};

export type AgendaActivityStatus = "confirmada" | "tentativa" | "cancelada";
export type AgendaAttendance = "pendiente" | "alcalde" | "designado";

export type NewAgendaActivity = {
  date: string;
  startTime: string;
  endTime?: string | null;
  title: string;
  place?: string | null;
  description?: string | null;
  status?: AgendaActivityStatus;
  createdByUserId: string;
  createdByName: string;
};

export type UpdateAgendaActivity = Omit<NewAgendaActivity, "createdByUserId" | "createdByName">;

export type AgendaActor = {
  userId: string;
  name: string;
};

function mapActivity(activity: typeof agendaActividades.$inferSelect): AgendaActivity {
  return {
    id: activity.id,
    date: activity.fecha,
    startTime: activity.horaInicio.slice(0, 5),
    endTime: activity.horaFin?.slice(0, 5) ?? null,
    title: activity.titulo,
    place: activity.lugar,
    description: activity.descripcion,
    status: activity.estado as AgendaActivityStatus,
    attendance: activity.asistencia as AgendaAttendance,
    delegatePositionCode: activity.representanteCargoCodigo,
    delegatePositionName: activity.representanteCargo,
    delegateUnitName: activity.representanteUnidad,
    decisionByName: activity.decisionPorNombre,
    decidedAt: activity.decisionAt?.toISOString() ?? null,
    createdByName: activity.creadoPorNombre,
  };
}

export async function listAgendaActivities(from: string, to: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(agendaActividades)
    .where(and(gte(agendaActividades.fecha, from), lte(agendaActividades.fecha, to)))
    .orderBy(asc(agendaActividades.fecha), asc(agendaActividades.horaInicio));
  return rows.map(mapActivity);
}

export async function createAgendaActivity(input: NewAgendaActivity) {
  const db = getDb();
  const [created] = await db
    .insert(agendaActividades)
    .values({
      fecha: input.date,
      horaInicio: input.startTime,
      horaFin: input.endTime || null,
      titulo: input.title.trim(),
      lugar: input.place?.trim() || null,
      descripcion: input.description?.trim() || null,
      estado: input.status ?? "tentativa",
      creadoPorUsuarioId: input.createdByUserId,
      creadoPorNombre: input.createdByName,
    })
    .returning();

  await db.insert(auditoria).values({
    entidad: "agenda_actividad",
    entidadId: created.id,
    accion: "crear",
    detalle: {
      fecha: created.fecha,
      horaInicio: created.horaInicio,
      titulo: created.titulo,
      actorUserId: input.createdByUserId,
      actorName: input.createdByName,
    },
  });

  return mapActivity(created);
}

export async function updateAgendaActivity(
  id: string,
  input: UpdateAgendaActivity,
  actor: AgendaActor,
) {
  const db = getDb();
  const [previous] = await db.select().from(agendaActividades).where(eq(agendaActividades.id, id)).limit(1);
  if (!previous) return null;
  const nextSnapshot: AgendaActivity = {
    id,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime || null,
    title: input.title.trim(),
    place: input.place?.trim() || null,
    description: input.description?.trim() || null,
    status: input.status === "cancelada"
      ? "cancelada"
      : previous.estado === "confirmada"
        ? "confirmada"
        : "tentativa",
    attendance: previous.asistencia as AgendaAttendance,
    delegatePositionCode: previous.representanteCargoCodigo,
    delegatePositionName: previous.representanteCargo,
    delegateUnitName: previous.representanteUnidad,
    decisionByName: previous.decisionPorNombre,
    decidedAt: previous.decisionAt?.toISOString() ?? null,
    createdByName: previous.creadoPorNombre,
  };
  const [updatedRows] = await db.batch([
    db.update(agendaActividades)
      .set({
        fecha: nextSnapshot.date,
        horaInicio: nextSnapshot.startTime,
        horaFin: nextSnapshot.endTime,
        titulo: nextSnapshot.title,
        lugar: nextSnapshot.place,
        descripcion: nextSnapshot.description,
        estado: nextSnapshot.status,
        updatedAt: new Date(),
      })
      .where(eq(agendaActividades.id, id))
      .returning(),
    db.insert(auditoria).values({
      entidad: "agenda_actividad",
      entidadId: id,
      accion: "actualizar",
      detalle: {
        anterior: mapActivity(previous),
        actualizado: nextSnapshot,
        actorUserId: actor.userId,
        actorName: actor.name,
      },
    }),
  ] as const);
  const [updated] = updatedRows;
  return updated ? mapActivity(updated) : null;
}

export type AgendaAttendanceDecision = {
  attendance: Exclude<AgendaAttendance, "pendiente">;
  delegatePositionCode?: string | null;
  delegatePositionName?: string | null;
  delegateUnitName?: string | null;
};

export type AgendaAttendanceDecisionResult =
  | { item: AgendaActivity; reason: null }
  | { item: null; reason: "not_found" | "cancelled" };

export async function decideAgendaAttendance(
  id: string,
  input: AgendaAttendanceDecision,
  actor: AgendaActor,
): Promise<AgendaAttendanceDecisionResult> {
  const db = getDb();
  const [previous] = await db.select().from(agendaActividades).where(eq(agendaActividades.id, id)).limit(1);
  if (!previous) return { item: null, reason: "not_found" };
  if (previous.estado === "cancelada") return { item: null, reason: "cancelled" };

  const delegated = input.attendance === "designado";
  const decisionAt = new Date();
  const [updatedRows] = await db.batch([
    db.update(agendaActividades)
      .set({
        estado: "confirmada",
        asistencia: input.attendance,
        representanteCargoCodigo: delegated ? input.delegatePositionCode?.trim() || null : null,
        representanteCargo: delegated ? input.delegatePositionName?.trim() || null : null,
        representanteUnidad: delegated ? input.delegateUnitName?.trim() || null : null,
        decisionPorUsuarioId: actor.userId,
        decisionPorNombre: actor.name,
        decisionAt,
        updatedAt: decisionAt,
      })
      .where(eq(agendaActividades.id, id))
      .returning(),
    db.insert(auditoria).values({
      entidad: "agenda_actividad",
      entidadId: id,
      accion: delegated ? "designar_representante" : "confirmar_asistencia_alcalde",
      detalle: {
        anterior: mapActivity(previous),
        asistencia: input.attendance,
        representanteCargoCodigo: delegated ? input.delegatePositionCode : null,
        representanteCargo: delegated ? input.delegatePositionName : null,
        representanteUnidad: delegated ? input.delegateUnitName : null,
        actorUserId: actor.userId,
        actorName: actor.name,
      },
    }),
  ] as const);
  const [updated] = updatedRows;
  if (!updated) return { item: null, reason: "not_found" };
  return { item: mapActivity(updated), reason: null };
}

export async function deleteAgendaActivity(id: string, actor: AgendaActor) {
  const db = getDb();
  const [previous] = await db.select().from(agendaActividades).where(eq(agendaActividades.id, id)).limit(1);
  if (!previous) return false;
  await db.batch([
    db.delete(agendaActividades).where(eq(agendaActividades.id, id)),
    db.insert(auditoria).values({
      entidad: "agenda_actividad",
      entidadId: id,
      accion: "eliminar",
      detalle: {
        actividad: mapActivity(previous),
        actorUserId: actor.userId,
        actorName: actor.name,
      },
    }),
  ] as const);
  return true;
}
