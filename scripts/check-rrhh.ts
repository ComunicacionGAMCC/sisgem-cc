import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

async function main() {
  if (!process.env.DATABASE_URL || !process.env.HEALTH_DATABASE_URL) {
    throw new Error("Faltan las conexiones de base de datos para la verificación.");
  }
  const municipal = postgres(process.env.DATABASE_URL, { max: 1 });
  const health = postgres(process.env.HEALTH_DATABASE_URL, { max: 1 });
  try {
    const [municipalResult] = await municipal<{
      cargos: number; tablas: number; chofer: string;
    }[]>`
      select
        (select count(*)::integer from rrhh_cargos) cargos,
        (select count(*)::integer from information_schema.tables where table_schema = 'public' and table_name like 'rrhh_%') tablas,
        (select nombre from cargos_organigrama where codigo = 'ALC-002') chofer
    `;
    const [accessResult] = await health<{ roles: number; permisos: number }[]>`
      select
        (select count(*)::integer from access_control.roles where code in ('sigem_rrhh', 'sigem_prensa')) roles,
        (select count(*)::integer from access_control.permissions where code like 'sigem.hr.%' or code like 'sigem.agenda.%') permisos
    `;
    console.log(JSON.stringify({ municipal: municipalResult, access: accessResult }));
  } finally {
    await Promise.all([municipal.end(), health.end()]);
  }
}

void main();
