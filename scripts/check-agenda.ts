import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import { config } from "dotenv";
import {
  createAgendaActivity,
  deleteAgendaActivity,
  listAgendaActivities,
  updateAgendaActivity,
} from "../db/agenda";
import { getDb } from "../db/index";
import { agendaActividades, auditoria } from "../db/schema";

config({ path: ".env.local", quiet: true });

const validationDate = "2099-12-30";

async function cleanupValidationActivities() {
  const db = getDb();
  const staleActivities = await db
    .select({ id: agendaActividades.id })
    .from(agendaActividades)
    .where(and(
      eq(agendaActividades.fecha, validationDate),
      like(agendaActividades.titulo, "Validación temporal %"),
    ));

  for (const activity of staleActivities) {
    await db.batch([
      db.delete(auditoria).where(eq(auditoria.entidadId, activity.id)),
      db.delete(agendaActividades).where(eq(agendaActividades.id, activity.id)),
    ] as const);
  }
}

async function main() {
  const actor = { userId: randomUUID(), name: "Validación automática de agenda" };
  const title = `Validación temporal ${Date.now()}`;

  try {
    await cleanupValidationActivities();
    const created = await createAgendaActivity({
      date: validationDate,
      startTime: "08:00",
      endTime: "09:00",
      title,
      place: "Despacho del Alcalde",
      description: "Actividad temporal para validar el flujo completo.",
      status: "tentativa",
      createdByUserId: actor.userId,
      createdByName: actor.name,
    });
    if (created.status !== "tentativa") throw new Error("No se creó la actividad por confirmar.");

    const confirmed = await updateAgendaActivity(created.id, {
      date: created.date,
      startTime: created.startTime,
      endTime: created.endTime,
      title: `${title} editada`,
      place: created.place,
      description: created.description,
      status: "confirmada",
    }, actor);
    if (!confirmed || confirmed.status !== "confirmada" || !confirmed.title.endsWith("editada")) {
      throw new Error("No se editó y confirmó la actividad correctamente.");
    }

    const updated = await updateAgendaActivity(created.id, {
      date: confirmed.date,
      startTime: confirmed.startTime,
      endTime: confirmed.endTime,
      title: confirmed.title,
      place: confirmed.place,
      description: confirmed.description,
      status: "cancelada",
    }, actor);
    if (!updated || updated.status !== "cancelada" || !updated.title.endsWith("editada")) {
      throw new Error("No se editó y canceló la actividad correctamente.");
    }

    const listed = await listAgendaActivities(validationDate, validationDate);
    if (!listed.some((item) => item.id === created.id && item.status === "cancelada")) {
      throw new Error("La actividad cancelada no aparece en el historial de su fecha.");
    }

    if (!await deleteAgendaActivity(created.id, actor)) {
      throw new Error("No se eliminó la actividad temporal.");
    }
    const afterDelete = await listAgendaActivities(validationDate, validationDate);
    if (afterDelete.some((item) => item.id === created.id)) {
      throw new Error("La actividad eliminada todavía aparece en la agenda.");
    }

    console.log("Agenda validada: crear, editar, confirmar, cancelar y eliminar.");
  } finally {
    await cleanupValidationActivities();
  }
}

void main();
