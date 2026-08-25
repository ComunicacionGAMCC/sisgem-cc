import { and, asc, gte, lte } from "drizzle-orm";
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
  status: string;
  createdByName: string | null;
};

export type NewAgendaActivity = {
  date: string;
  startTime: string;
  endTime?: string | null;
  title: string;
  place?: string | null;
  description?: string | null;
  status?: "confirmada" | "tentativa";
  createdByUserId: string;
  createdByName: string;
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
    status: activity.estado,
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
      estado: input.status ?? "confirmada",
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
