import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { crearFichaMedica, obtenerPanelFichasMedicas } from "../db/fichas-medicas";
import { getDb } from "../db/index";

config({ path: ".env.local", quiet: true });

const panel = await obtenerPanelFichasMedicas();
const cupo = panel.availability.find((item) => item.available > 0);
if (!cupo) throw new Error("No existe un cupo disponible para ejecutar la comprobación médica.");

const solicitudId = randomUUID();
const ficha = await crearFichaMedica({
  solicitudId,
  especialidadId: cupo.specialtyId,
  cupoId: cupo.id,
  nombrePaciente: "Paciente Control Sistema",
  documento: "QA00001",
  telefono: "70000000",
  consentimiento: true,
});

if (!ficha.code || ficha.turn < 1) throw new Error("La ficha de comprobación no fue emitida correctamente.");

await getDb().execute(sql`
  with retirada as (
    delete from fichas_medicas
    where solicitud_id = ${solicitudId}
    returning cupo_id
  )
  update cupos_medicos cm
  set cupos_reservados = greatest(cm.cupos_reservados - 1, 0), updated_at = now()
  where cm.id in (select cupo_id from retirada)
`);

console.log(`Comprobación médica correcta: ${ficha.specialty}, turno ${ficha.turn}; registro de prueba retirado.`);
