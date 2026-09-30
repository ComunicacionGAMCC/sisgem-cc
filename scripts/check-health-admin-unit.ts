import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { listarContrataciones } from "../db/contrataciones";
import { obtenerPanelRecursosHumanos } from "../db/recursos-humanos";
import { getDb } from "../db/index";
import { rrhhCargos, rrhhPersonal, unidades } from "../db/schema";

config({ path: ".env.local", quiet: true });

const db = getDb();
const [unit] = await db.select({ id: unidades.id, name: unidades.nombre })
  .from(unidades).where(eq(unidades.codigo, "DAS")).limit(1);
const [position] = await db.select({ id: rrhhCargos.id, name: rrhhCargos.nombre, salary: rrhhCargos.haberBasico })
  .from(rrhhCargos).where(eq(rrhhCargos.codigo, "DAS-001")).limit(1);
const [staff] = await db.select({ firstNames: rrhhPersonal.nombres, lastNames: rrhhPersonal.apellidos, email: rrhhPersonal.email })
  .from(rrhhPersonal).where(eq(rrhhPersonal.email, "mel.2512@gmail.com")).limit(1);

if (!unit || unit.name !== "Dirección Administrativa Municipal de Salud") throw new Error("La unidad administrativa de Salud no quedó registrada.");
if (!position || position.name !== "Director Administrativo Municipal de Salud") throw new Error("El cargo de Melvi no quedó registrado.");
if (Number(position.salary) !== 7948) throw new Error("El haber básico de Dirección Administrativa Municipal de Salud no coincide con la escala 2026.");
if (!staff || `${staff.firstNames} ${staff.lastNames}` !== "Melvi Romero") throw new Error("Melvi no quedó incorporada a Recursos Humanos.");

const [procurement, hr] = await Promise.all([listarContrataciones(), obtenerPanelRecursosHumanos()]);
if (!procurement.units.some((item) => item.id === unit.id)) throw new Error("La unidad de Salud no aparece en Contrataciones.");
if (!hr.staff.some((item) => item.email === staff.email && item.positionId === position.id)) throw new Error("Melvi no aparece en la planilla de personal.");

console.log(`Validación correcta: ${unit.name}, ${position.name}, ${staff.firstNames} ${staff.lastNames}, haber ${position.salary}.`);
