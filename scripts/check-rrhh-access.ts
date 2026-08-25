import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

async function main() {
  if (!process.env.HEALTH_DATABASE_URL) {
    throw new Error("Falta la conexión de la base de datos de accesos.");
  }

  const sql = postgres(process.env.HEALTH_DATABASE_URL, { max: 1 });
  try {
    const [role] = await sql<{
      role: string;
      permissionCount: number;
      missingHrPermissions: number;
    }[]>`
      select
        role.name as role,
        count(distinct role_permission.permission_id)::integer as "permissionCount",
        count(distinct permission.id) filter (
          where permission.code like 'sigem.hr.%'
            and role_permission.permission_id is null
        )::integer as "missingHrPermissions"
      from access_control.roles role
      cross join access_control.permissions permission
      left join access_control.role_permissions role_permission
        on role_permission.role_id = role.id
       and role_permission.permission_id = permission.id
      where role.code = 'sigem_rrhh'
      group by role.name
    `;

    const users = await sql<{
      fullName: string;
      jobTitle: string | null;
      roles: string[];
    }[]>`
      select
        profile.full_name as "fullName",
        profile.job_title as "jobTitle",
        coalesce(
          array_agg(distinct role.code) filter (where role.code is not null),
          array[]::text[]
        ) as roles
      from access_control.user_profiles profile
      left join access_control.user_role_assignments assignment
        on assignment.user_id = profile.id
       and assignment.active
      left join access_control.roles role on role.id = assignment.role_id
      where profile.job_title ilike '%recursos humanos%'
         or profile.job_title ilike '%RRHH%'
         or role.code = 'sigem_rrhh'
      group by profile.id, profile.full_name, profile.job_title
      order by profile.full_name
    `;

    console.log(JSON.stringify({ role, users }));
  } finally {
    await sql.end();
  }
}

void main();
