import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { auditoria, hojasDeRuta, solicitantes } from "../db/schema";

config({ path: ".env.local", quiet: true });

const baseUrl = process.env.SIGEM_TEST_URL ?? "http://127.0.0.1:3100";
const db = getDb();
let codigoCreado = "";

try {
  const home = await fetch(baseUrl);
  if (!home.ok || !(await home.text()).includes("Municipio Digital")) {
    throw new Error("La página principal no respondió correctamente.");
  }

  const listado = await fetch(`${baseUrl}/api/hojas-ruta`);
  const listadoJson = (await listado.json()) as { items?: Array<{ code: string }> };
  if (!listado.ok || !listadoJson.items || listadoJson.items.length < 4) {
    throw new Error("La API de listado no devolvió la semilla esperada.");
  }

  const seguimiento = await fetch(`${baseUrl}/api/seguimiento/HR-2026-00481`);
  const seguimientoJson = (await seguimiento.json()) as { item?: { events?: unknown[] } };
  if (!seguimiento.ok || !seguimientoJson.item?.events?.length) {
    throw new Error("La API de seguimiento no devolvió eventos públicos.");
  }

  const creacion = await fetch(`${baseUrl}/api/hojas-ruta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      remitente: "Validación HTTP SIGEM",
      documento: `HTTP-${Date.now()}`,
      asunto: "Prueba temporal de la API de Hojas de Ruta",
      descripcion: "Este registro será eliminado automáticamente al finalizar la prueba.",
      prioridad: "alta",
      unidadCodigo: "COM",
      tipo: "solicitud_externa",
    }),
  });
  const creacionJson = (await creacion.json()) as { item?: { code: string }; error?: string };
  if (!creacion.ok || !creacionJson.item?.code) {
    throw new Error(creacionJson.error || "La API no pudo crear la hoja de ruta temporal.");
  }
  codigoCreado = creacionJson.item.code;

  const seguimientoNuevo = await fetch(
    `${baseUrl}/api/seguimiento/${encodeURIComponent(codigoCreado)}`,
  );
  if (!seguimientoNuevo.ok) throw new Error("El nuevo código no quedó disponible para seguimiento.");

  console.log(
    `Validación HTTP correcta: página 200, ${listadoJson.items.length} registros, seguimiento y alta operativos.`,
  );
} finally {
  if (codigoCreado) {
    const [registro] = await db
      .select({ id: hojasDeRuta.id, solicitanteId: hojasDeRuta.solicitanteId })
      .from(hojasDeRuta)
      .where(eq(hojasDeRuta.codigo, codigoCreado))
      .limit(1);
    if (registro) {
      await db.delete(auditoria).where(eq(auditoria.entidadId, registro.id));
      await db.delete(hojasDeRuta).where(eq(hojasDeRuta.id, registro.id));
      await db.delete(solicitantes).where(eq(solicitantes.id, registro.solicitanteId));
    }
  }
}
