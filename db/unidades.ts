import { asc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { unidades } from "./schema";

export async function listarUnidadesActivas() {
  return getDb()
    .select({ id: unidades.id, code: unidades.codigo, name: unidades.nombre })
    .from(unidades)
    .where(eq(unidades.activa, true))
    .orderBy(asc(unidades.nombre));
}
