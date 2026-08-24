import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/index";
import {
  auditoria,
  derivaciones,
  eventosSeguimiento,
  funcionarios,
  hojasDeRuta,
  secuenciasCodigo,
  solicitantes,
  unidades,
} from "../db/schema";

config({ path: ".env.local", quiet: true });

const db = getDb();

const unidadesBase = [
  { codigo: "SG", nombre: "Secretaría General" },
  { codigo: "COM", nombre: "Unidad de Comunicación" },
  { codigo: "OBR", nombre: "Obras Públicas" },
  { codigo: "CAT", nombre: "Catastro" },
  { codigo: "DH", nombre: "Desarrollo Humano" },
  { codigo: "DAP", nombre: "Desarrollo Agropecuario" },
];

for (const unidad of unidadesBase) {
  await db
    .insert(unidades)
    .values(unidad)
    .onConflictDoUpdate({
      target: unidades.codigo,
      set: { nombre: unidad.nombre, activa: true, updatedAt: new Date() },
    });
}

const listaUnidades = await db.select().from(unidades);
const porCodigo = new Map(listaUnidades.map((unidad) => [unidad.codigo, unidad]));
const comunicacion = porCodigo.get("COM")!;
const secretaria = porCodigo.get("SG")!;

await db
  .insert(funcionarios)
  .values({
    unidadId: comunicacion.id,
    nombres: "Saúl",
    apellidos: "Cabrera",
    cargo: "Responsable de Comunicación",
    email: "comunicacion@cuatrocanadas.gob.bo",
  })
  .onConflictDoUpdate({
    target: funcionarios.email,
    set: { unidadId: comunicacion.id, activo: true, updatedAt: new Date() },
  });

const [funcionario] = await db
  .select()
  .from(funcionarios)
  .where(eq(funcionarios.email, "comunicacion@cuatrocanadas.gob.bo"))
  .limit(1);

const demos = [
  {
    codigo: "HR-2026-00481",
    asunto: "Solicitud de spot para feria educativa",
    remitente: "U.E. Nacional Cuatro Cañadas",
    documento: "DEMO-UE-NACIONAL",
    unidad: "COM",
    prioridad: "urgente" as const,
    estado: "en_proceso" as const,
  },
  {
    codigo: "HR-2026-00477",
    asunto: "Solicitud de mantenimiento de alumbrado",
    remitente: "OTB 15 de Agosto",
    documento: "DEMO-OTB-15-AGOSTO",
    unidad: "OBR",
    prioridad: "alta" as const,
    estado: "en_proceso" as const,
  },
  {
    codigo: "HR-2026-00469",
    asunto: "Solicitud de apoyo técnico productivo",
    remitente: "Asociación de productores",
    documento: "DEMO-ASOC-PROD",
    unidad: "DAP",
    prioridad: "normal" as const,
    estado: "recibido" as const,
  },
  {
    codigo: "HR-2026-00454",
    asunto: "Certificación de datos catastrales",
    remitente: "María Elena Vargas",
    documento: "DEMO-MEV-001",
    unidad: "CAT",
    prioridad: "normal" as const,
    estado: "finalizado" as const,
  },
];

for (const demo of demos) {
  const [existente] = await db
    .select({ id: hojasDeRuta.id })
    .from(hojasDeRuta)
    .where(eq(hojasDeRuta.codigo, demo.codigo))
    .limit(1);
  if (existente) continue;

  const [solicitante] = await db
    .insert(solicitantes)
    .values({ tipo: "institucion", nombre: demo.remitente, documento: demo.documento })
    .onConflictDoUpdate({
      target: solicitantes.documento,
      set: { nombre: demo.remitente, updatedAt: new Date() },
    })
    .returning();

  const unidad = porCodigo.get(demo.unidad)!;
  const [hoja] = await db
    .insert(hojasDeRuta)
    .values({
      codigo: demo.codigo,
      asunto: demo.asunto,
      descripcion: `Registro demostrativo inicial: ${demo.asunto}.`,
      prioridad: demo.prioridad,
      estado: demo.estado,
      solicitanteId: solicitante.id,
      unidadActualId: unidad.id,
      creadoPorId: funcionario.id,
      fechaLimite: new Date(Date.now() + 2 * 86_400_000),
      finalizadoAt: demo.estado === "finalizado" ? new Date() : null,
    })
    .returning();

  await db.insert(derivaciones).values({
    hojaRutaId: hoja.id,
    unidadOrigenId: secretaria.id,
    unidadDestinoId: unidad.id,
    derivadoPorId: funcionario.id,
    estado: demo.estado === "finalizado" ? "atendida" : "recibida",
    nota: "Derivación de demostración para la puesta en marcha.",
    recibidoAt: new Date(),
  });

  await db.insert(eventosSeguimiento).values([
    {
      hojaRutaId: hoja.id,
      estado: "recibido",
      titulo: "Solicitud recibida",
      descripcion: "Secretaría General registró la solicitud.",
      unidadId: secretaria.id,
      funcionarioId: funcionario.id,
      publico: true,
    },
    {
      hojaRutaId: hoja.id,
      estado: demo.estado,
      titulo: demo.estado === "finalizado" ? "Respuesta y cierre" : `Atención en ${unidad.nombre}`,
      descripcion:
        demo.estado === "finalizado"
          ? "La solicitud fue respondida y cerrada."
          : "La unidad responsable se encuentra atendiendo la solicitud.",
      unidadId: unidad.id,
      funcionarioId: funcionario.id,
      publico: true,
    },
  ]);

  await db.insert(auditoria).values({
    entidad: "hoja_de_ruta",
    entidadId: hoja.id,
    accion: "semilla_inicial",
    funcionarioId: funcionario.id,
    detalle: { codigo: demo.codigo },
  });
}

await db
  .insert(secuenciasCodigo)
  .values({ gestion: 2026, ultimo: 481 })
  .onConflictDoNothing();

const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(hojasDeRuta);
console.log(`Semilla completada: ${total} hojas de ruta disponibles.`);
