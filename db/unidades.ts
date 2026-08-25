import { asc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { cargosOrganigrama, unidades } from "./schema";

export async function listarUnidadesActivas() {
  return getDb()
    .select({ id: unidades.id, code: unidades.codigo, name: unidades.nombre })
    .from(unidades)
    .where(eq(unidades.activa, true))
    .orderBy(asc(unidades.nombre));
}

export async function listarCargosOrganigramaActivos() {
  return getDb()
    .select({
      id: cargosOrganigrama.id,
      code: cargosOrganigrama.codigo,
      name: cargosOrganigrama.nombre,
      level: cargosOrganigrama.nivel,
      parentCode: cargosOrganigrama.superiorCodigo,
      unitId: unidades.id,
      unitCode: unidades.codigo,
      unitName: unidades.nombre,
    })
    .from(cargosOrganigrama)
    .innerJoin(unidades, eq(unidades.id, cargosOrganigrama.unidadId))
    .where(eq(cargosOrganigrama.activo, true))
    .orderBy(asc(cargosOrganigrama.orden), asc(cargosOrganigrama.nombre));
}
