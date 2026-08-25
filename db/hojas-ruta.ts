import { and, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { getMunicipalYear } from "../lib/municipal-date";
import { getDb } from "./index";
import {
  auditoria,
  derivaciones,
  eventosSeguimiento,
  funcionarios,
  hojasDeRuta,
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
  };
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

export async function crearHojaDeRuta(input: NuevaHojaRuta) {
  const db = getDb();
  const [unidad] = await db
    .select()
    .from(unidades)
    .where(and(eq(unidades.codigo, input.unidadCodigo), eq(unidades.activa, true)))
    .limit(1);

  if (!unidad) throw new Error("La unidad de destino no existe o no está activa.");

  const [funcionario] = await db
    .select({ id: funcionarios.id, unidadId: funcionarios.unidadId })
    .from(funcionarios)
    .where(eq(funcionarios.activo, true))
    .limit(1);

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
      creadoPorId: funcionario?.id ?? null,
      fechaLimite,
    })
    .returning();

  await db.insert(derivaciones).values({
    hojaRutaId: hoja.id,
    unidadOrigenId: funcionario?.unidadId ?? null,
    unidadDestinoId: unidad.id,
    derivadoPorId: funcionario?.id ?? null,
    estado: "pendiente",
    nota: "Derivación inicial al registrar la hoja de ruta.",
  });

  await db.insert(eventosSeguimiento).values([
    {
      hojaRutaId: hoja.id,
      estado: "recibido",
      titulo: "Solicitud recibida",
      descripcion: "La solicitud fue registrada en el sistema municipal.",
      unidadId: funcionario?.unidadId ?? unidad.id,
      funcionarioId: funcionario?.id ?? null,
      publico: true,
    },
    {
      hojaRutaId: hoja.id,
      estado: "derivado",
      titulo: `Derivada a ${unidad.nombre}`,
      descripcion: "La unidad responsable recibió la asignación inicial.",
      unidadId: unidad.id,
      funcionarioId: funcionario?.id ?? null,
      publico: true,
    },
  ]);

  await db.insert(auditoria).values({
    entidad: "hoja_de_ruta",
    entidadId: hoja.id,
    accion: "crear",
    funcionarioId: funcionario?.id ?? null,
    detalle: { codigo, unidadDestino: unidad.codigo, prioridad: hoja.prioridad },
  });

  return obtenerSeguimiento(codigo);
}
