import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { crearFichaMedica, obtenerPanelFichasMedicas } from "../db/fichas-medicas";

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

const healthDatabaseUrl = process.env.HEALTH_DATABASE_URL;
if (!healthDatabaseUrl) throw new Error("HEALTH_DATABASE_URL no está configurada para la comprobación.");

const healthSql = postgres(healthDatabaseUrl, { prepare: false, max: 1, ssl: "require" });
await healthSql`
  with retirada as (
    delete from health.appointments
    where request_id = ${solicitudId}
    returning slot_id
  )
  update health.appointment_slots cm
  set reserved_count = greatest(cm.reserved_count - 1, 0), updated_at = now()
  where cm.id in (select slot_id from retirada)
`;
await healthSql.end();

console.log(`Comprobación médica correcta: ${ficha.specialty}, turno ${ficha.turn}; registro de prueba retirado.`);
