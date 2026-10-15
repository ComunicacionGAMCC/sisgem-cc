import { config } from "dotenv";
import postgres from "postgres";
import assert from "node:assert/strict";
import { hasCabinetAgendaManagement, hasCabinetAgendaDecision, type AccessContext } from "../db/access-control";

config({ path: ".env.local", quiet: true });
const sql = postgres(process.env.HEALTH_DATABASE_URL!, { max: 1 });
try {
  const rows = await sql`
    select p.full_name, p.job_title, r.code, r.module,
      a.scope_type, a.scope_label,
      coalesce(array_agg(distinct permission.code) filter (where permission.code is not null), '{}') permissions
    from access_control.user_profiles p
    join access_control.user_role_assignments a on a.user_id = p.id and a.active
    join access_control.roles r on r.id = a.role_id and r.active
    left join access_control.role_permissions rp on rp.role_id = r.id
    left join access_control.permissions permission on permission.id = rp.permission_id
    where p.active and (p.full_name ilike '%remberto%' or p.full_name ilike '%johan%' or p.full_name ilike '%clairol%')
      and a.valid_from <= now() and (a.valid_until is null or a.valid_until > now())
    group by p.id, r.id, a.scope_type, a.scope_label
  `;
  assert(rows.length >= 3, "Faltan los accesos esperados");
  for (const row of rows) {
    const context = { profile: { jobTitle: row.job_title }, roles: [{ module: row.module, scopeType: row.scope_type, scopeLabel: row.scope_label }], permissions: row.permissions } as AccessContext;
    const manage = hasCabinetAgendaManagement(context);
    const decide = hasCabinetAgendaDecision(context);
    console.log(JSON.stringify({ name: row.full_name, position: row.job_title, role: row.code, manage, decide }));
    assert(manage && decide, `Falta acceso completo: ${row.full_name}`);
  }
  const press = { profile: { jobTitle: 'Prensa' }, roles: [{ module: 'sigem' }], permissions: ['sigem.agenda.read'] } as AccessContext;
  assert(!hasCabinetAgendaManagement(press) && !hasCabinetAgendaDecision(press));
} finally { await sql.end(); }
