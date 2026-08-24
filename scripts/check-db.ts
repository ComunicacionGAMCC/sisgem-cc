import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { crearHojaDeRuta, listarHojasDeRuta, obtenerSeguimiento } from "../db/hojas-ruta";
import { getDb } from "../db/index";
import { auditoria, hojasDeRuta, solicitantes } from "../db/schema";

config({ path: ".env.local", quiet: true });

const db = getDb();
await db
  .delete(solicitantes)
  .where(eq(solicitantes.nombre, "Validación automatizada SIGEM"));

const iniciales = await listarHojasDeRuta({ filtro: "todos" });
if (iniciales.length < 4) throw new Error("La semilla no contiene las hojas de ruta esperadas.");

const demo = await obtenerSeguimiento("HR-2026-00481");
if (!demo || demo.events.length < 2) throw new Error("El seguimiento ciudadano no devolvió eventos.");

const creada = await crearHojaDeRuta({
  remitente: "Validación automatizada SIGEM",
  asunto: "Comprobación temporal del flujo de creación",
  descripcion: "Registro temporal creado por db:check y eliminado al finalizar.",
  prioridad: "normal",
  unidadCodigo: "COM",
  documento: `CHECK-${Date.now()}`,
});

if (!creada?.code || creada.events.length < 2) {
  throw new Error("La creación real no generó código o seguimiento.");
}

const [registro] = await db
  .select({ id: hojasDeRuta.id, solicitanteId: hojasDeRuta.solicitanteId })
  .from(hojasDeRuta)
  .where(eq(hojasDeRuta.codigo, creada.code))
  .limit(1);

if (!registro) throw new Error("La hoja creada no quedó persistida.");

await db.delete(auditoria).where(eq(auditoria.entidadId, registro.id));
await db.delete(hojasDeRuta).where(eq(hojasDeRuta.id, registro.id));
await db.delete(solicitantes).where(eq(solicitantes.id, registro.solicitanteId));

console.log(`Validación DB correcta: ${iniciales.length} registros, búsqueda, seguimiento y creación operativos.`);
