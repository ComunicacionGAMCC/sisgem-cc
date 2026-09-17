import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

const expectedPermissions = [
  "sigem.agenda.decide",
  "sigem.agenda.read",
  "sigem.hr.read",
  "sigem.reports.read",
  "sigem.routes.read",
];

async function main() {
  if (!process.env.HEALTH_DATABASE_URL) {
    throw new Error("Falta la conexión de la base de datos de accesos.");
  }

  const sql = postgres(process.env.HEALTH_DATABASE_URL, { max: 1 });
  try {
    const [role] = await sql<{
      name: string;
      requiresMfa: boolean;
      permissions: string[];
    }[]>`
      select
        role.name,
        role.requires_mfa as "requiresMfa",
        coalesce(array_agg(permission.code order by permission.code), array[]::text[]) as permissions
      from access_control.roles role
      left join access_control.role_permissions role_permission on role_permission.role_id = role.id
      left join access_control.permissions permission on permission.id = role_permission.permission_id
      where role.code = 'sigem_alcalde' and role.active
      group by role.id, role.name, role.requires_mfa
    `;

    if (!role) throw new Error("El rol Alcalde Municipal no existe o está inactivo.");
    if (JSON.stringify(role.permissions) !== JSON.stringify(expectedPermissions)) {
      throw new Error(`Permisos incorrectos para Alcalde Municipal: ${role.permissions.join(", ")}`);
    }
    console.log(JSON.stringify({ role: role.name, requiresMfa: role.requiresMfa, permissions: role.permissions }));
  } finally {
    await sql.end();
  }
}

void main();
