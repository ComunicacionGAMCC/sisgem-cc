import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { contrataciones, contratacionesEventos, contratacionesSecuencia, unidades } from "./schema";

export type ProcurementActor = { id: string; name: string };

export async function listarContrataciones() {
  const db = getDb();
  const [items, units] = await Promise.all([
    db.select({
      id: contrataciones.id,
      code: contrataciones.codigo,
      object: contrataciones.objeto,
      modality: contrataciones.modalidad,
      status: contrataciones.estado,
      amount: contrataciones.montoReferencial,
      unitId: unidades.id,
      unit: unidades.nombre,
      responsible: contrataciones.responsableNombre,
      startDate: contrataciones.fechaInicio,
      deadline: contrataciones.fechaLimite,
      createdAt: contrataciones.createdAt,
      updatedAt: contrataciones.updatedAt,
    }).from(contrataciones)
      .innerJoin(unidades, eq(unidades.id, contrataciones.unidadSolicitanteId))
      .orderBy(desc(contrataciones.fechaInicio), desc(contrataciones.createdAt)),
    db.select({ id: unidades.id, code: unidades.codigo, name: unidades.nombre })
      .from(unidades).where(eq(unidades.activa, true)).orderBy(asc(unidades.nombre)),
  ]);
  return { items, units };
}

export async function crearContratacion(input: {
  object: string;
  modality: string;
  amount: string;
  unitId: string;
  responsible: string | null;
  startDate: string;
  deadline: string | null;
  actor: ProcurementActor;
}) {
  return getDb().transaction(async (tx) => {
    const year = Number(input.startDate.slice(0, 4));
    const [sequence] = await tx.insert(contratacionesSecuencia).values({ gestion: year, ultimo: 1 })
      .onConflictDoUpdate({
        target: contratacionesSecuencia.gestion,
        set: { ultimo: sql`${contratacionesSecuencia.ultimo} + 1`, updatedAt: new Date() },
      }).returning({ last: contratacionesSecuencia.ultimo });
    const code = `C-${year}-${String(sequence.last).padStart(4, "0")}`;
    const [item] = await tx.insert(contrataciones).values({
      codigo: code,
      objeto: input.object,
      modalidad: input.modality,
      montoReferencial: input.amount,
      unidadSolicitanteId: input.unitId,
      responsableNombre: input.responsible,
      fechaInicio: input.startDate,
      fechaLimite: input.deadline,
      creadoPorUsuarioId: input.actor.id,
      creadoPorNombre: input.actor.name,
    }).returning();
    await tx.insert(contratacionesEventos).values({
      contratacionId: item.id,
      estado: item.estado,
      detalle: "Proceso registrado.",
      actorUsuarioId: input.actor.id,
      actorNombre: input.actor.name,
    });
    return item;
  });
}

export async function actualizarEstadoContratacion(input: {
  id: string;
  status: string;
  detail: string | null;
  actor: ProcurementActor;
}) {
  return getDb().transaction(async (tx) => {
    const [item] = await tx.update(contrataciones).set({ estado: input.status, updatedAt: new Date() })
      .where(eq(contrataciones.id, input.id)).returning();
    if (!item) throw new Error("El proceso de contratación no existe.");
    await tx.insert(contratacionesEventos).values({
      contratacionId: item.id,
      estado: input.status,
      detalle: input.detail,
      actorUsuarioId: input.actor.id,
      actorNombre: input.actor.name,
    });
    return item;
  });
}
