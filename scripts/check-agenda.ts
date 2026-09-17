import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import { config } from "dotenv";
import {
  createAgendaActivity,
  decideAgendaAttendance,
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

    const edited = await updateAgendaActivity(created.id, {
      date: created.date,
      startTime: created.startTime,
      endTime: created.endTime,
      title: `${title} editada`,
      place: created.place,
      description: created.description,
      status: "tentativa",
    }, actor);
    if (!edited || edited.status !== "tentativa" || !edited.title.endsWith("editada")) {
      throw new Error("No se editó la actividad correctamente.");
    }

    const attendanceDecision = await decideAgendaAttendance(created.id, {
      attendance: "alcalde",
    }, actor);
    if (!attendanceDecision.item
      || attendanceDecision.item.status !== "confirmada"
      || attendanceDecision.item.attendance !== "alcalde") {
      throw new Error("No se confirmó la asistencia del alcalde.");
    }

    const delegatedDecision = await decideAgendaAttendance(created.id, {
      attendance: "designado",
      delegatePositionCode: "SM-001",
      delegatePositionName: "Secretario Municipal",
      delegateUnitName: "Secretaría Municipal",
    }, actor);
    if (!delegatedDecision.item
      || delegatedDecision.item.attendance !== "designado"
      || delegatedDecision.item.delegatePositionCode !== "SM-001") {
      throw new Error("No se registró la designación del representante.");
    }

    const updated = await updateAgendaActivity(created.id, {
      date: delegatedDecision.item.date,
      startTime: delegatedDecision.item.startTime,
      endTime: delegatedDecision.item.endTime,
      title: delegatedDecision.item.title,
      place: delegatedDecision.item.place,
      description: delegatedDecision.item.description,
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

    console.log("Agenda validada: crear, editar, confirmar alcalde, designar, cancelar y eliminar.");
  } finally {
    await cleanupValidationActivities();
  }
}

void main();
