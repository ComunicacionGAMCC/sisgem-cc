import { and, asc, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { getMunicipalYear } from "../lib/municipal-date";
import { getDb } from "./index";
import {
  auditoria,
  derivaciones,
  eventosSeguimiento,
  hojasDeRuta,
  hojasRutaAdjuntos,
  secuenciasCodigo,
  solicitantes,
  unidades,
} from "./schema";

export type FiltroHojas = "todos" | "pendientes" | "finalizados";

export type NuevaHojaRuta = {
  remitente: string;
  asunto: string;
  descripcion?: string;
  tipo?: string;
  prioridad?: "baja" | "normal" | "alta" | "urgente";
  unidadCodigo: string;
  documento?: string;
  telefono?: string;
  email?: string;
};

export type ActorHojaRuta = {
  userId: string;
  name: string;
  unitId?: string | null;
};

export type AccionHojaRuta =
  | { type: "receive"; note?: string }
  | { type: "derive"; destinationUnitId: string; note: string }
  | { type: "act"; title: string; detail: string; public: boolean }
  | { type: "observe"; detail: string; public: boolean }
  | { type: "deadline"; dueAt: string; detail?: string }
  | { type: "close"; detail: string; public: boolean }
  | { type: "archive"; detail?: string }
  | { type: "reopen"; detail: string };

export class HojaRutaAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HojaRutaAccessError";
  }
}

const estadoEtiquetas = {
  recibido: "Recibido",
  derivado: "Derivado",
  en_proceso: "En proceso",
  observado: "Observado",
  finalizado: "Finalizado",
  archivado: "Archivado",
} as const;

function tonoEstado(estado: keyof typeof estadoEtiquetas, prioridad: string) {
  if (estado === "finalizado" || estado === "archivado") return "done";
  if (prioridad === "urgente" || estado === "observado") return "danger";
  if (estado === "recibido") return "received";
  return "progress";
}

function textoVencimiento(fechaLimite: Date | null, estado: keyof typeof estadoEtiquetas) {
  if (estado === "finalizado") return "Trámite finalizado";
  if (!fechaLimite) return "Sin fecha límite";
  const dias = Math.ceil((fechaLimite.getTime() - Date.now()) / 86_400_000);
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoy";
  return `${dias} día${dias === 1 ? "" : "s"} restante${dias === 1 ? "" : "s"}`;
}

export async function listarHojasDeRuta({
  buscar = "",
  filtro = "todos",
  unidadIds = null,
}: {
  buscar?: string;
  filtro?: FiltroHojas;
  unidadIds?: string[] | null;
}) {
  const db = getDb();
  const condiciones = [];
  const termino = buscar.trim();

  if (unidadIds && unidadIds.length === 0) return [];
  if (unidadIds) condiciones.push(inArray(hojasDeRuta.unidadActualId, unidadIds));

  if (termino) {
    condiciones.push(
      or(
        ilike(hojasDeRuta.codigo, `%${termino}%`),
        ilike(hojasDeRuta.asunto, `%${termino}%`),
        ilike(solicitantes.nombre, `%${termino}%`),
      ),
    );
  }

  if (filtro === "finalizados") {
    condiciones.push(inArray(hojasDeRuta.estado, ["finalizado", "archivado"]));
  } else if (filtro === "pendientes") {
    condiciones.push(notInArray(hojasDeRuta.estado, ["finalizado", "archivado"]));
  }

  const filas = await db
    .select({
      id: hojasDeRuta.id,
      code: hojasDeRuta.codigo,
      title: hojasDeRuta.asunto,
      description: hojasDeRuta.descripcion,
      sender: solicitantes.nombre,
      unit: unidades.nombre,
      unitCode: unidades.codigo,
      state: hojasDeRuta.estado,
      priority: hojasDeRuta.prioridad,
      dueAt: hojasDeRuta.fechaLimite,
      createdAt: hojasDeRuta.createdAt,
    })
    .from(hojasDeRuta)
    .innerJoin(solicitantes, eq(hojasDeRuta.solicitanteId, solicitantes.id))
    .innerJoin(unidades, eq(hojasDeRuta.unidadActualId, unidades.id))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(hojasDeRuta.createdAt))
    .limit(100);

  return filas.map((fila) => ({
    ...fila,
    status: estadoEtiquetas[fila.state],
    tone: tonoEstado(fila.state, fila.priority),
    due: textoVencimiento(fila.dueAt, fila.state),
    createdAt: fila.createdAt.toISOString(),
    dueAt: fila.dueAt?.toISOString() ?? null,
  }));
}

export async function obtenerSeguimiento(codigo: string) {
  const db = getDb();
  const [hoja] = await db
    .select({
      id: hojasDeRuta.id,
      code: hojasDeRuta.codigo,
      title: hojasDeRuta.asunto,
      description: hojasDeRuta.descripcion,
      sender: solicitantes.nombre,
      unit: unidades.nombre,
      state: hojasDeRuta.estado,
      priority: hojasDeRuta.prioridad,
      createdAt: hojasDeRuta.createdAt,
      updatedAt: hojasDeRuta.updatedAt,
    })
    .from(hojasDeRuta)
    .innerJoin(solicitantes, eq(hojasDeRuta.solicitanteId, solicitantes.id))
    .innerJoin(unidades, eq(hojasDeRuta.unidadActualId, unidades.id))
    .where(eq(hojasDeRuta.codigo, codigo.trim().toUpperCase()))
    .limit(1);

  if (!hoja) return null;

  const eventos = await db
    .select({
      id: eventosSeguimiento.id,
      state: eventosSeguimiento.estado,
      title: eventosSeguimiento.titulo,
      description: eventosSeguimiento.descripcion,
      unit: unidades.nombre,
      createdAt: eventosSeguimiento.createdAt,
    })
    .from(eventosSeguimiento)
    .leftJoin(unidades, eq(eventosSeguimiento.unidadId, unidades.id))
    .where(and(eq(eventosSeguimiento.hojaRutaId, hoja.id), eq(eventosSeguimiento.publico, true)))
    .orderBy(eventosSeguimiento.createdAt);
  const adjuntos = await db.select({
    id: hojasRutaAdjuntos.id,
    name: hojasRutaAdjuntos.nombre,
    mimeType: hojasRutaAdjuntos.tipoMime,
    size: hojasRutaAdjuntos.tamanoBytes,
    createdAt: hojasRutaAdjuntos.createdAt,
  }).from(hojasRutaAdjuntos).where(and(
    eq(hojasRutaAdjuntos.hojaRutaId, hoja.id),
    eq(hojasRutaAdjuntos.publico, true),
  )).orderBy(hojasRutaAdjuntos.createdAt);

  return {
    ...hoja,
    status: estadoEtiquetas[hoja.state],
    tone: tonoEstado(hoja.state, hoja.priority),
    createdAt: hoja.createdAt.toISOString(),
    updatedAt: hoja.updatedAt.toISOString(),
    events: eventos.map((evento) => ({
      ...evento,
      status: estadoEtiquetas[evento.state],
      createdAt: evento.createdAt.toISOString(),
    })),
    attachments: adjuntos.map((adjunto) => ({ ...adjunto, createdAt: adjunto.createdAt.toISOString() })),
  };
}

export async function obtenerAdjuntoPublico(codigo: string, attachmentId: string) {
  const db = getDb();
  const [attachment] = await db.select({
    name: hojasRutaAdjuntos.nombre,
    mimeType: hojasRutaAdjuntos.tipoMime,
    base64: hojasRutaAdjuntos.contenidoBase64,
  }).from(hojasRutaAdjuntos).innerJoin(
    hojasDeRuta,
    eq(hojasDeRuta.id, hojasRutaAdjuntos.hojaRutaId),
  ).where(and(
    eq(hojasDeRuta.codigo, codigo.trim().toUpperCase()),
    eq(hojasRutaAdjuntos.id, attachmentId),
    eq(hojasRutaAdjuntos.publico, true),
  )).limit(1);
  if (!attachment) throw new Error("El documento no existe o no es público.");
  return attachment;
}

async function siguienteCodigo() {
  const db = getDb();
  const gestion = getMunicipalYear();
  const resultado = await db.execute(sql`
    insert into ${secuenciasCodigo} (gestion, ultimo, updated_at)
    values (${gestion}, 1, now())
    on conflict (gestion)
    do update set ultimo = ${secuenciasCodigo.ultimo} + 1, updated_at = now()
    returning ultimo
  `);
  const filas = Array.isArray(resultado)
    ? (resultado as unknown as Array<{ ultimo: number }>)
    : ((resultado as unknown as { rows?: Array<{ ultimo: number }> }).rows ?? []);
  const ultimo = Number(filas[0]?.ultimo);
  if (!Number.isFinite(ultimo)) throw new Error("No se pudo generar el código de hoja de ruta.");
  return `HR-${gestion}-${String(ultimo).padStart(5, "0")}`;
}

export async function crearHojaDeRuta(input: NuevaHojaRuta, actor?: ActorHojaRuta) {
  const db = getDb();
  const [unidad] = await db
    .select()
    .from(unidades)
    .where(and(eq(unidades.codigo, input.unidadCodigo), eq(unidades.activa, true)))
    .limit(1);

  if (!unidad) throw new Error("La unidad de destino no existe o no está activa.");

  const datosSolicitante = {
    tipo: "persona" as const,
    nombre: input.remitente.trim(),
    documento: input.documento?.trim() || null,
    telefono: input.telefono?.trim() || null,
    email: input.email?.trim() || null,
  };
  const [solicitante] = datosSolicitante.documento
    ? await db
        .insert(solicitantes)
        .values(datosSolicitante)
        .onConflictDoUpdate({
          target: solicitantes.documento,
          set: {
            nombre: datosSolicitante.nombre,
            telefono: datosSolicitante.telefono,
            email: datosSolicitante.email,
            updatedAt: new Date(),
          },
        })
        .returning()
    : await db.insert(solicitantes).values(datosSolicitante).returning();

  const codigo = await siguienteCodigo();
  const ahora = new Date();
  const diasLimite = input.prioridad === "urgente" ? 1 : input.prioridad === "alta" ? 3 : 5;
  const fechaLimite = new Date(ahora.getTime() + diasLimite * 86_400_000);

  const [hoja] = await db
    .insert(hojasDeRuta)
    .values({
      codigo,
      tipo: input.tipo?.trim() || "solicitud_externa",
      asunto: input.asunto.trim(),
      descripcion: input.descripcion?.trim() || null,
      prioridad: input.prioridad ?? "normal",
      estado: "derivado",
      solicitanteId: solicitante.id,
      unidadActualId: unidad.id,
      creadoPorId: null,
      fechaLimite,
    })
    .returning();

  await db.insert(derivaciones).values({
    hojaRutaId: hoja.id,
    unidadOrigenId: actor?.unitId ?? null,
    unidadDestinoId: unidad.id,
    derivadoPorId: null,
    estado: "pendiente",
    nota: "Derivación inicial al registrar la hoja de ruta.",
  });

  await db.insert(eventosSeguimiento).values([
    {
      hojaRutaId: hoja.id,
      estado: "recibido",
      titulo: "Solicitud recibida",
      descripcion: "La solicitud fue registrada en el sistema municipal.",
      unidadId: actor?.unitId ?? unidad.id,
      funcionarioId: null,
      actorUsuarioId: actor?.userId ?? null,
      actorNombre: actor?.name ?? null,
      publico: true,
    },
    {
      hojaRutaId: hoja.id,
      estado: "derivado",
      titulo: `Derivada a ${unidad.nombre}`,
      descripcion: "La unidad responsable recibió la asignación inicial.",
      unidadId: unidad.id,
      funcionarioId: null,
      actorUsuarioId: actor?.userId ?? null,
      actorNombre: actor?.name ?? null,
      publico: true,
    },
  ]);

  await db.insert(auditoria).values({
    entidad: "hoja_de_ruta",
    entidadId: hoja.id,
    accion: "crear",
    funcionarioId: null,
    detalle: { codigo, unidadDestino: unidad.codigo, prioridad: hoja.prioridad, actorUserId: actor?.userId, actorName: actor?.name },
  });

  return obtenerSeguimiento(codigo);
}

async function verificarAccesoHojaRuta(
  hojaRutaId: string,
  unidadIds: string[] | null,
  soloUnidadActual = false,
) {
  const db = getDb();
  const [hoja] = await db
    .select({ id: hojasDeRuta.id, state: hojasDeRuta.estado, currentUnitId: hojasDeRuta.unidadActualId })
    .from(hojasDeRuta)
    .where(eq(hojasDeRuta.id, hojaRutaId))
    .limit(1);
  if (!hoja) throw new Error("La hoja de ruta no existe.");
  if (unidadIds === null) return hoja;
  if (unidadIds.includes(hoja.currentUnitId)) return hoja;
  if (soloUnidadActual) throw new HojaRutaAccessError("La hoja de ruta pertenece actualmente a otra unidad.");
  if (!unidadIds.length) throw new HojaRutaAccessError("Tu cuenta no tiene una unidad municipal asignada.");

  const [participacion] = await db
    .select({ id: derivaciones.id })
    .from(derivaciones)
    .where(and(
      eq(derivaciones.hojaRutaId, hojaRutaId),
      or(
        inArray(derivaciones.unidadOrigenId, unidadIds),
        inArray(derivaciones.unidadDestinoId, unidadIds),
      ),
    ))
    .limit(1);
  if (!participacion) throw new HojaRutaAccessError("No tienes acceso a esta hoja de ruta.");
  return hoja;
}

export async function obtenerDetalleHojaRuta(hojaRutaId: string, unidadIds: string[] | null) {
  await verificarAccesoHojaRuta(hojaRutaId, unidadIds);
  const db = getDb();
  const [hojas, unidadesMunicipales, eventos, movimientos, adjuntos] = await Promise.all([
    db.select({
      id: hojasDeRuta.id,
      code: hojasDeRuta.codigo,
      type: hojasDeRuta.tipo,
      title: hojasDeRuta.asunto,
      description: hojasDeRuta.descripcion,
      priority: hojasDeRuta.prioridad,
      state: hojasDeRuta.estado,
      currentUnitId: hojasDeRuta.unidadActualId,
      currentUnit: unidades.nombre,
      dueAt: hojasDeRuta.fechaLimite,
      finishedAt: hojasDeRuta.finalizadoAt,
      createdAt: hojasDeRuta.createdAt,
      updatedAt: hojasDeRuta.updatedAt,
      sender: solicitantes.nombre,
      senderDocument: solicitantes.documento,
      senderPhone: solicitantes.telefono,
      senderEmail: solicitantes.email,
    }).from(hojasDeRuta)
      .innerJoin(unidades, eq(unidades.id, hojasDeRuta.unidadActualId))
      .innerJoin(solicitantes, eq(solicitantes.id, hojasDeRuta.solicitanteId))
      .where(eq(hojasDeRuta.id, hojaRutaId)).limit(1),
    db.select({ id: unidades.id, code: unidades.codigo, name: unidades.nombre })
      .from(unidades).where(eq(unidades.activa, true)).orderBy(asc(unidades.nombre)),
    db.select({
      id: eventosSeguimiento.id,
      state: eventosSeguimiento.estado,
      title: eventosSeguimiento.titulo,
      description: eventosSeguimiento.descripcion,
      unitId: eventosSeguimiento.unidadId,
      public: eventosSeguimiento.publico,
      actorName: eventosSeguimiento.actorNombre,
      createdAt: eventosSeguimiento.createdAt,
    }).from(eventosSeguimiento)
      .where(eq(eventosSeguimiento.hojaRutaId, hojaRutaId))
      .orderBy(desc(eventosSeguimiento.createdAt)),
    db.select().from(derivaciones)
      .where(eq(derivaciones.hojaRutaId, hojaRutaId))
      .orderBy(desc(derivaciones.derivadoAt)),
    db.select({
      id: hojasRutaAdjuntos.id,
      eventId: hojasRutaAdjuntos.eventoId,
      name: hojasRutaAdjuntos.nombre,
      mimeType: hojasRutaAdjuntos.tipoMime,
      size: hojasRutaAdjuntos.tamanoBytes,
      public: hojasRutaAdjuntos.publico,
      uploadedBy: hojasRutaAdjuntos.subidoPorNombre,
      createdAt: hojasRutaAdjuntos.createdAt,
    }).from(hojasRutaAdjuntos)
      .where(eq(hojasRutaAdjuntos.hojaRutaId, hojaRutaId))
      .orderBy(desc(hojasRutaAdjuntos.createdAt)),
  ]);
  const [hoja] = hojas;
  if (!hoja) throw new Error("La hoja de ruta no existe.");
  const unitNames = new Map(unidadesMunicipales.map((unit) => [unit.id, unit.name]));
  return {
    ...hoja,
    status: estadoEtiquetas[hoja.state],
    tone: tonoEstado(hoja.state, hoja.priority),
    due: textoVencimiento(hoja.dueAt, hoja.state),
    dueAt: hoja.dueAt?.toISOString() ?? null,
    finishedAt: hoja.finishedAt?.toISOString() ?? null,
    createdAt: hoja.createdAt.toISOString(),
    updatedAt: hoja.updatedAt.toISOString(),
    units: unidadesMunicipales,
    events: eventos.map((event) => ({
      ...event,
      status: estadoEtiquetas[event.state],
      unit: event.unitId ? unitNames.get(event.unitId) ?? null : null,
      createdAt: event.createdAt.toISOString(),
    })),
    derivations: movimientos.map((movement) => ({
      id: movement.id,
      originUnit: movement.unidadOrigenId ? unitNames.get(movement.unidadOrigenId) ?? null : null,
      destinationUnit: unitNames.get(movement.unidadDestinoId) ?? "Unidad municipal",
      state: movement.estado,
      note: movement.nota,
      derivedAt: movement.derivadoAt.toISOString(),
      receivedAt: movement.recibidoAt?.toISOString() ?? null,
    })),
    attachments: adjuntos.map((attachment) => ({ ...attachment, createdAt: attachment.createdAt.toISOString() })),
  };
}

export async function gestionarHojaRuta(
  hojaRutaId: string,
  action: AccionHojaRuta,
  actor: ActorHojaRuta,
  unidadIds: string[] | null,
) {
  const hoja = await verificarAccesoHojaRuta(hojaRutaId, unidadIds, true);
  const closedStates = new Set(["finalizado", "archivado"]);
  if (closedStates.has(hoja.state) && action.type !== "archive" && action.type !== "reopen") {
    throw new Error("La hoja de ruta está cerrada. Debes reabrirla antes de modificarla.");
  }
  const db = getDb();
  let eventState: keyof typeof estadoEtiquetas = hoja.state;
  let eventTitle = "Actuación registrada";
  let eventDetail = "";
  let eventPublic = false;
  let eventUnitId = hoja.currentUnitId;

  // Neon HTTP no soporta transacciones interactivas. Las operaciones se
  // ejecutan secuencialmente y se respaldan con su registro de auditoría.
  const tx = db;
  {
    if (action.type === "receive") {
      await tx.update(derivaciones).set({ estado: "recibida", recibidoAt: new Date() })
        .where(and(eq(derivaciones.hojaRutaId, hojaRutaId), eq(derivaciones.estado, "pendiente")));
      await tx.update(hojasDeRuta).set({ estado: "en_proceso", updatedAt: new Date() })
        .where(eq(hojasDeRuta.id, hojaRutaId));
      eventState = "en_proceso";
      eventTitle = "Recepción confirmada";
      eventDetail = action.note?.trim() || "La unidad responsable confirmó la recepción de la documentación.";
      eventPublic = true;
    } else if (action.type === "derive") {
      const [destination] = await tx.select({ id: unidades.id, name: unidades.nombre })
        .from(unidades).where(and(eq(unidades.id, action.destinationUnitId), eq(unidades.activa, true))).limit(1);
      if (!destination) throw new Error("La unidad de destino no existe o está inactiva.");
      if (destination.id === hoja.currentUnitId) throw new Error("Selecciona una unidad de destino diferente.");
      await tx.update(derivaciones).set({ estado: "atendida" })
        .where(and(eq(derivaciones.hojaRutaId, hojaRutaId), inArray(derivaciones.estado, ["pendiente", "recibida"])));
      await tx.insert(derivaciones).values({
        hojaRutaId,
        unidadOrigenId: hoja.currentUnitId,
        unidadDestinoId: destination.id,
        estado: "pendiente",
        nota: action.note.trim(),
      });
      await tx.update(hojasDeRuta).set({
        unidadActualId: destination.id,
        estado: "derivado",
        updatedAt: new Date(),
      }).where(eq(hojasDeRuta.id, hojaRutaId));
      eventState = "derivado";
      eventTitle = `Derivada a ${destination.name}`;
      eventDetail = action.note.trim();
      eventPublic = true;
      eventUnitId = destination.id;
    } else if (action.type === "act") {
      await tx.update(hojasDeRuta).set({ estado: "en_proceso", updatedAt: new Date() })
        .where(eq(hojasDeRuta.id, hojaRutaId));
      eventState = "en_proceso";
      eventTitle = action.title.trim();
      eventDetail = action.detail.trim();
      eventPublic = action.public;
    } else if (action.type === "observe") {
      await tx.update(hojasDeRuta).set({ estado: "observado", updatedAt: new Date() })
        .where(eq(hojasDeRuta.id, hojaRutaId));
      eventState = "observado";
      eventTitle = "Trámite observado";
      eventDetail = action.detail.trim();
      eventPublic = action.public;
    } else if (action.type === "deadline") {
      const dueAt = new Date(`${action.dueAt}T23:59:59-04:00`);
      if (Number.isNaN(dueAt.getTime())) throw new Error("La fecha límite no es válida.");
      await tx.update(hojasDeRuta).set({ fechaLimite: dueAt, updatedAt: new Date() })
        .where(eq(hojasDeRuta.id, hojaRutaId));
      eventTitle = "Plazo actualizado";
      eventDetail = action.detail?.trim() || `Nueva fecha límite: ${action.dueAt}.`;
      eventPublic = false;
    } else if (action.type === "close") {
      const now = new Date();
      await tx.update(derivaciones).set({ estado: "atendida" })
        .where(and(eq(derivaciones.hojaRutaId, hojaRutaId), inArray(derivaciones.estado, ["pendiente", "recibida"])));
      await tx.update(hojasDeRuta).set({ estado: "finalizado", finalizadoAt: now, updatedAt: now })
        .where(eq(hojasDeRuta.id, hojaRutaId));
      eventState = "finalizado";
      eventTitle = "Respuesta y cierre";
      eventDetail = action.detail.trim();
      eventPublic = action.public;
    } else if (action.type === "archive") {
      if (hoja.state !== "finalizado") throw new Error("Solo se puede archivar una hoja finalizada.");
      await tx.update(hojasDeRuta).set({ estado: "archivado", updatedAt: new Date() })
        .where(eq(hojasDeRuta.id, hojaRutaId));
      eventState = "archivado";
      eventTitle = "Trámite archivado";
      eventDetail = action.detail?.trim() || "El expediente fue enviado al archivo institucional.";
      eventPublic = false;
    } else if (action.type === "reopen") {
      if (!closedStates.has(hoja.state)) throw new Error("La hoja de ruta todavía está activa.");
      await tx.update(hojasDeRuta).set({ estado: "en_proceso", finalizadoAt: null, updatedAt: new Date() })
        .where(eq(hojasDeRuta.id, hojaRutaId));
      eventState = "en_proceso";
      eventTitle = "Trámite reabierto";
      eventDetail = action.detail.trim();
      eventPublic = false;
    }

    await tx.insert(eventosSeguimiento).values({
      hojaRutaId,
      estado: eventState,
      titulo: eventTitle,
      descripcion: eventDetail || null,
      unidadId: eventUnitId,
      actorUsuarioId: actor.userId,
      actorNombre: actor.name,
      publico: eventPublic,
    });
    await tx.insert(auditoria).values({
      entidad: "hoja_de_ruta",
      entidadId: hojaRutaId,
      accion: action.type,
      detalle: { actorUserId: actor.userId, actorName: actor.name, action },
    });
  }
  return obtenerDetalleHojaRuta(hojaRutaId, unidadIds);
}

export async function guardarAdjuntoHojaRuta(input: {
  hojaRutaId: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  base64: string;
  public: boolean;
  actor: ActorHojaRuta;
  unitIds: string[] | null;
}) {
  const hoja = await verificarAccesoHojaRuta(input.hojaRutaId, input.unitIds, true);
  if (hoja.state === "archivado") throw new Error("No se pueden agregar documentos a un expediente archivado.");
  const db = getDb();
  const tx = db;
  {
    const [event] = await tx.insert(eventosSeguimiento).values({
      hojaRutaId: input.hojaRutaId,
      estado: hoja.state,
      titulo: "Documento adjunto",
      descripcion: input.name,
      unidadId: hoja.currentUnitId,
      actorUsuarioId: input.actor.userId,
      actorNombre: input.actor.name,
      publico: input.public,
    }).returning({ id: eventosSeguimiento.id });
    const [attachment] = await tx.insert(hojasRutaAdjuntos).values({
      hojaRutaId: input.hojaRutaId,
      eventoId: event.id,
      nombre: input.name,
      tipoMime: input.mimeType,
      tamanoBytes: input.size,
      sha256: input.sha256,
      contenidoBase64: input.base64,
      publico: input.public,
      subidoPorUsuarioId: input.actor.userId,
      subidoPorNombre: input.actor.name,
    }).returning({ id: hojasRutaAdjuntos.id });
    await tx.insert(auditoria).values({
      entidad: "hoja_ruta_adjunto",
      entidadId: attachment.id,
      accion: "subir",
      detalle: { hojaRutaId: input.hojaRutaId, name: input.name, size: input.size, sha256: input.sha256, actorUserId: input.actor.userId },
    });
    return obtenerDetalleHojaRuta(input.hojaRutaId, input.unitIds);
  }
}

export async function obtenerAdjuntoHojaRuta(
  hojaRutaId: string,
  attachmentId: string,
  unidadIds: string[] | null,
) {
  await verificarAccesoHojaRuta(hojaRutaId, unidadIds);
  const [attachment] = await getDb().select({
    id: hojasRutaAdjuntos.id,
    name: hojasRutaAdjuntos.nombre,
    mimeType: hojasRutaAdjuntos.tipoMime,
    size: hojasRutaAdjuntos.tamanoBytes,
    base64: hojasRutaAdjuntos.contenidoBase64,
  }).from(hojasRutaAdjuntos).where(and(
    eq(hojasRutaAdjuntos.id, attachmentId),
    eq(hojasRutaAdjuntos.hojaRutaId, hojaRutaId),
  )).limit(1);
  if (!attachment) throw new Error("El documento adjunto no existe.");
  return attachment;
}
