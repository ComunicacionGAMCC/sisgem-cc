import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import {
  crearHojaDeRuta,
  gestionarHojaRuta,
  guardarAdjuntoHojaRuta,
  obtenerAdjuntoPublico,
  obtenerDetalleHojaRuta,
  obtenerSeguimiento,
} from "../db/hojas-ruta";
import { getDb } from "../db/index";
import { auditoria, derivaciones, hojasDeRuta, solicitantes, unidades } from "../db/schema";

config({ path: ".env.local", quiet: true });
const db = getDb();
const actor = { userId: randomUUID(), name: "Validación automatizada" };
const sender = `CHECK-FLUJO-${Date.now()}`;

const activeUnits = await db.select({ id: unidades.id, code: unidades.codigo }).from(unidades).where(eq(unidades.activa, true));
const secretariaGeneral = activeUnits.find((unit) => unit.code === "SG");
const destinationUnit = activeUnits.find((unit) => unit.code !== "SG");
if (!secretariaGeneral || !destinationUnit) throw new Error("Se necesitan Secretaría General y otra unidad activa para validar derivaciones.");

let routeId = "";
let applicantId = "";
let attachmentId = "";
try {
  const created = await crearHojaDeRuta({ remitente: sender, consignatario: "Alcalde Municipal", asunto: "Validación integral temporal" }, actor);
  if (!created) throw new Error("No se pudo crear el expediente temporal.");
  routeId = created.id;
  const [row] = await db.select({
    applicantId: hojasDeRuta.solicitanteId,
    state: hojasDeRuta.estado,
    currentUnitId: hojasDeRuta.unidadActualId,
    consignee: hojasDeRuta.consignatario,
  }).from(hojasDeRuta).where(eq(hojasDeRuta.id, routeId));
  if (!row) throw new Error("La hoja temporal no quedó persistida.");
  applicantId = row.applicantId;
  if (row.state !== "recibido" || row.currentUnitId !== secretariaGeneral.id || row.consignee !== "Alcalde Municipal") {
    throw new Error("El registro inicial no quedó recibido en Secretaría General con su consignatario.");
  }
  const initialDerivations = await db.select({ id: derivaciones.id }).from(derivaciones).where(eq(derivaciones.hojaRutaId, routeId));
  if (initialDerivations.length !== 0) throw new Error("El registro inicial creó una derivación automática.");

  await gestionarHojaRuta(routeId, { type: "derive", destinationUnitId: destinationUnit.id, note: "Primera derivación autorizada después de revisión" }, actor, null);
  await assertRejected(
    "cerrar antes de recibir",
    gestionarHojaRuta(routeId, { type: "close", detail: "Cierre prematuro de validación", public: true }, actor, null),
    /recepción/i,
  );
  await assertRejected(
    "volver a derivar antes de recibir",
    gestionarHojaRuta(routeId, { type: "derive", destinationUnitId: secretariaGeneral.id, note: "Derivación prematura de validación" }, actor, null),
    /recepción/i,
  );
  await gestionarHojaRuta(routeId, { type: "receive", note: "Recepción validada" }, actor, null);
  await assertRejected(
    "recibir dos veces",
    gestionarHojaRuta(routeId, { type: "receive", note: "Recepción duplicada" }, actor, null),
    /ya fue recibida|pendiente de recepción/i,
  );
  await gestionarHojaRuta(routeId, { type: "act", title: "Informe revisado", detail: "Se revisó la documentación presentada.", public: true }, actor, null);
  await gestionarHojaRuta(routeId, { type: "deadline", dueAt: "2026-12-31", detail: "Plazo de validación" }, actor, null);
  await gestionarHojaRuta(routeId, { type: "derive", destinationUnitId: secretariaGeneral.id, note: "Retorno a Secretaría General para cierre" }, actor, null);
  await gestionarHojaRuta(routeId, { type: "receive", note: "Segunda unidad recibió" }, actor, null);

  const bytes = Buffer.from("Documento temporal de validación SIGEM", "utf8");
  const attached = await guardarAdjuntoHojaRuta({
    hojaRutaId: routeId, name: "validacion.txt", mimeType: "text/plain", size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64"),
    public: true, actor, unitIds: null,
  });
  attachmentId = attached.attachments[0]?.id ?? "";
  if (!attachmentId) throw new Error("No se persistió el documento adjunto.");

  await gestionarHojaRuta(routeId, { type: "close", detail: "Respuesta final de validación.", public: true }, actor, null);
  await gestionarHojaRuta(routeId, { type: "archive", detail: "Archivo de validación" }, actor, null);
  const archived = await obtenerDetalleHojaRuta(routeId, null);
  if (archived.state !== "archivado" || archived.derivations.length < 2 || archived.attachments.length !== 1) throw new Error("El expediente no completó el flujo esperado.");

  const publicTracking = await obtenerSeguimiento(created.code);
  if (!publicTracking?.attachments.length) throw new Error("El documento público no aparece en el seguimiento ciudadano.");
  const downloaded = await obtenerAdjuntoPublico(created.code, attachmentId);
  if (Buffer.from(downloaded.base64, "base64").toString("utf8") !== bytes.toString("utf8")) throw new Error("El documento descargado no coincide.");

  const reopened = await gestionarHojaRuta(routeId, { type: "reopen", detail: "Reapertura controlada de validación" }, actor, null);
  if (reopened.state !== "en_proceso") throw new Error("La reapertura no actualizó el estado.");
  console.log("Validación integral correcta: registro sin derivación, primera derivación, recepción, actuación, retorno, adjunto, cierre, archivo y reapertura.");
} finally {
  if (routeId) await db.delete(auditoria).where(eq(auditoria.entidadId, routeId));
  if (attachmentId) await db.delete(auditoria).where(eq(auditoria.entidadId, attachmentId));
  if (routeId) await db.delete(hojasDeRuta).where(eq(hojasDeRuta.id, routeId));
  if (applicantId) await db.delete(solicitantes).where(eq(solicitantes.id, applicantId));
  await db.delete(solicitantes).where(eq(solicitantes.nombre, sender));
}

async function assertRejected(label: string, operation: Promise<unknown>, expected: RegExp) {
  try {
    await operation;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!expected.test(message)) throw new Error(`${label}: mensaje inesperado: ${message}`);
    return;
  }
  throw new Error(`${label}: la operación debía ser rechazada.`);
}
