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
import { auditoria, hojasDeRuta, solicitantes, unidades } from "../db/schema";

config({ path: ".env.local", quiet: true });
const db = getDb();
const actor = { userId: randomUUID(), name: "Validación automatizada" };
const sender = `CHECK-FLUJO-${Date.now()}`;

const activeUnits = await db.select({ id: unidades.id, code: unidades.codigo }).from(unidades).where(eq(unidades.activa, true)).limit(2);
if (activeUnits.length < 2) throw new Error("Se necesitan dos unidades activas para validar derivaciones.");

let routeId = "";
let applicantId = "";
let attachmentId = "";
try {
  const created = await crearHojaDeRuta({ remitente: sender, asunto: "Validación integral temporal", unidadCodigo: activeUnits[0].code }, actor);
  if (!created) throw new Error("No se pudo crear el expediente temporal.");
  routeId = created.id;
  const [row] = await db.select({ applicantId: hojasDeRuta.solicitanteId }).from(hojasDeRuta).where(eq(hojasDeRuta.id, routeId));
  applicantId = row.applicantId;

  await gestionarHojaRuta(routeId, { type: "receive", note: "Recepción validada" }, actor, null);
  await gestionarHojaRuta(routeId, { type: "act", title: "Informe revisado", detail: "Se revisó la documentación presentada.", public: true }, actor, null);
  await gestionarHojaRuta(routeId, { type: "deadline", dueAt: "2026-12-31", detail: "Plazo de validación" }, actor, null);
  await gestionarHojaRuta(routeId, { type: "derive", destinationUnitId: activeUnits[1].id, note: "Derivación de validación integral" }, actor, null);
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
  console.log("Validación integral correcta: recepción, actuación, plazo, derivación, adjunto, cierre, archivo y reapertura.");
} finally {
  if (routeId) await db.delete(auditoria).where(eq(auditoria.entidadId, routeId));
  if (attachmentId) await db.delete(auditoria).where(eq(auditoria.entidadId, attachmentId));
  if (routeId) await db.delete(hojasDeRuta).where(eq(hojasDeRuta.id, routeId));
  if (applicantId) await db.delete(solicitantes).where(eq(solicitantes.id, applicantId));
  await db.delete(solicitantes).where(eq(solicitantes.nombre, sender));
}
