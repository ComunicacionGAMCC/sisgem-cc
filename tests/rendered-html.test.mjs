import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Municipio Digital portal", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Municipio Digital \| Cuatro Cañadas/);
  assert.match(html, /Gobierno Autónomo Municipal de Cuatro Cañadas/);
  assert.match(html, /id="seguimiento"/);
  assert.match(html, /Consulta el código exacto entregado/);
  assert.match(html, /Saca tu ficha médica virtual aquí/);
  assert.match(html, /Hospital Municipal de Cuatro Cañadas/i);
  assert.match(html, /Solicitar ficha/);
  assert.match(html, /Denuncia anónima y protegida/);
  assert.match(html, /Acceder<\/button>/);
  assert.match(html, /Secretaría General o en la unidad municipal competente/);
  assert.doesNotMatch(html, /Iniciar un trámite/);
  assert.doesNotMatch(html, /DATABASE_URL|postgresql:\/\//i);
});

test("implements the complete auditable route workflow", async () => {
  const [ui, service, actionApi, attachmentApi, publicAttachmentApi, schema, migration] = await Promise.all([
    readFile(new URL("../app/hojas-ruta.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/hojas-ruta.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/hojas-ruta/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/hojas-ruta/[id]/adjuntos/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/seguimiento/[codigo]/adjuntos/[attachmentId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0006_greedy_mastermind.sql", import.meta.url), "utf8"),
  ]);
  for (const action of ["receive", "derive", "act", "observe", "deadline", "close", "archive", "reopen"]) {
    assert.match(service, new RegExp(`action\\.type === "${action}"`));
  }
  assert.match(ui, /Historial del trámite/);
  assert.match(ui, /Documentos adjuntos/);
  assert.match(ui, /Visible en seguimiento ciudadano/);
  assert.match(actionApi, /authorizeRequest/);
  assert.match(attachmentApi, /maximumSize = 3 \* 1024 \* 1024/);
  assert.match(publicAttachmentApi, /obtenerAdjuntoPublico/);
  assert.match(schema, /"hojas_ruta_adjuntos"/);
  assert.match(migration, /CREATE TABLE "hojas_ruta_adjuntos"/);
});

test("keeps municipal data lazy, protected, and ChatGPT Sites compatible", async () => {
  const [page, agenda, agendaService, agendaApi, accessServer, medical, dbIndex, schema, orgMigration, listApi, trackingApi, medicalApi, hosting, municipalDate, dateHook, routeService] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/agenda.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/agenda.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/access-control.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/medical.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_chunky_wasp.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/hojas-ruta/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/seguimiento/[codigo]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/fichas-medicas/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/municipal-date.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/use-municipal-date.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/hojas-ruta.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/hojas-ruta"/);
  assert.match(page, /\/api\/seguimiento\//);
  assert.match(page, /Acceso protegido · 2FA/);
  assert.match(page, /profile\.fullName\.trim\(\)\.split/);
  assert.match(page, /Buenos días, \{userName\}/);
  assert.doesNotMatch(page, /Buenos días, Saúl/);
  assert.match(municipalDate, /America\/La_Paz/);
  assert.match(dateHook, /setInterval\(refresh, 60_000\)/);
  assert.match(routeService, /getMunicipalYear\(\)/);
  assert.match(page, /AgendaSummary/);
  assert.match(page, /canAccessCabinetAgenda/);
  assert.match(agenda, /context\.profile\.jobTitle/);
  assert.match(agenda, /type="date"/);
  assert.match(agenda, /moveWeek\(-7\)/);
  assert.match(agenda, /moveWeek\(7\)/);
  assert.match(agenda, /method: "POST"/);
  assert.match(agenda, /\/api\/agenda/);
  assert.match(agendaService, /gte\(agendaActividades\.fecha, from\)/);
  assert.match(agendaService, /lte\(agendaActividades\.fecha, to\)/);
  assert.match(agendaApi, /export async function GET/);
  assert.match(agendaApi, /export async function POST/);
  assert.match(agendaApi, /requireCabinetAgendaAccess\(context\)/);
  assert.match(agendaApi, /requireCabinetAgendaManagement\(context\)/);
  assert.match(accessServer, /context\.profile\.jobTitle/);
  assert.match(accessServer, /La agenda del alcalde.*Secretar.*de Gabinete/);
  assert.doesNotMatch(page, /directores|Central 4 Este|avance de obra/);
  assert.doesNotMatch(`${page}\n${medical}`, /(?:jueves, 6 de agosto|Hoy, 4 de agosto|Martes, 4 de agosto|Al 4 de agosto|Fecha estimada: 6 de agosto)/i);
  assert.match(listApi, /export async function GET/);
  assert.match(listApi, /export async function POST/);
  assert.match(trackingApi, /obtenerSeguimiento/);
  assert.match(medical, /fetch\("\/api\/fichas-medicas"/);
  assert.match(medical, /Datos protegidos/);
  assert.match(medicalApi, /export async function GET/);
  assert.match(medicalApi, /export async function POST/);
  assert.match(dbIndex, /let database: ReturnType<typeof createDb> \| null = null/);
  assert.match(dbIndex, /if \(!database\) database = createDb\(\)/);
  assert.doesNotMatch(dbIndex, /neon\(process\.env\.DATABASE_URL!/);

  for (const table of [
    "unidades",
    "cargos_organigrama",
    "funcionarios",
    "solicitantes",
    "hojas_de_ruta",
    "derivaciones",
    "eventos_seguimiento",
    "agenda_actividades",
    "rrhh_cargos",
    "rrhh_personal",
    "rrhh_movimientos_cargo",
    "rrhh_planillas",
    "rrhh_planilla_items",
    "rrhh_descuentos",
    "auditoria",
  ]) {
    assert.match(schema, new RegExp(`"${table}"`));
  }

  assert.doesNotMatch(schema, /especialidades_medicas|cupos_medicos|fichas_medicas/);
  for (const direction of [
    "Dirección de Finanzas",
    "Dirección de Recaudaciones",
    "Dirección de Obras Públicas",
    "Dirección de Catastro Urbano y Rural",
    "Dirección de Desarrollo Agropecuario y Medio Ambiente",
    "Dirección de Desarrollo Humano y Social",
  ]) {
    assert.match(orgMigration, new RegExp(direction));
  }
  assert.match(orgMigration, /Asesor Legal/);
  assert.match(orgMigration, /Asesor de Desarrollo Normativo/);

  assert.match(hosting, /"project_id"/);
  assert.match(hosting, /"d1": null/);
  assert.doesNotMatch(`${page}\n${medical}\n${dbIndex}\n${schema}`, /postgresql:\/\//i);
});

test("protects the complete Human Resources workflow and press-only agenda", async () => {
  const [page, hrUi, hrApi, hrService, accessServer, agendaUi, hrMigration, accessMigration, fullHrControlMigration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recursos-humanos.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/recursos-humanos/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/recursos-humanos.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/access-control.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/agenda.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0005_superb_black_cat.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260825200500_rrhh_agenda_prensa_roles.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260825230033_grant_full_hr_control.sql", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Recursos Humanos/);
  assert.match(page, /role\.code === "sigem_prensa"/);
  assert.match(hrUi, /Planilla de personal/);
  assert.match(hrUi, /Cargos y contratos/);
  assert.match(hrUi, /Sueldos y salarios/);
  assert.match(hrUi, /Consultor individual de línea/);
  assert.match(hrUi, /Registrar descuento/);
  assert.match(hrApi, /authorizeRequest\(request, "sigem\.hr\.read"\)/);
  assert.match(hrApi, /sigem\.hr\.payroll/);
  assert.match(hrService, /rrhhMovimientosCargo/);
  assert.match(hrService, /recalcular|totalDescuentos|liquidoPagable/);
  assert.match(hrMigration, /Chofer del Ejecutivo y Coordinador/);
  assert.match(accessMigration, /'sigem_rrhh'/);
  assert.match(accessMigration, /'sigem_prensa'/);
  assert.match(accessMigration, /'sigem\.agenda\.read'/);
  assert.match(accessMigration, /'sigem\.hr\.payroll'/);
  assert.match(fullHrControlMigration, /permission\.code like 'sigem\.hr\.%'/);
  assert.match(fullHrControlMigration, /'global'::access_control\.scope_type/);
  assert.match(accessServer, /chofer\.\*ejecutivo\.\*coordinador/);
  assert.match(agendaUi, /canManageCabinetAgenda/);
  assert.match(agendaUi, /showForm && canManage/);
  assert.doesNotMatch(`${hrUi}\n${hrApi}\n${hrService}`, /HEALTH_DATABASE_URL|postgresql:\/\//i);
});

test("enforces scoped institutional access with MFA and auditable roles", async () => {
  const [accessUi, accessServer, userApi, managedUserApi, accessMigration, bootstrapMigration, managementMigration, bootstrapScript] = await Promise.all([
    readFile(new URL("../app/access.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/access-control.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/access/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/access/users/[userId]/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/migrations/20260824201726_access_control.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../supabase/migrations/20260824223407_allow_two_super_admin_bootstrap.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../supabase/migrations/20260825114139_super_admin_manage_users.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../scripts/bootstrap-superadmins.ts", import.meta.url), "utf8"),
  ]);

  for (const role of [
    "super_admin",
    "sigem_admin",
    "health_admin",
    "health_admission",
    "health_physician",
    "health_nursing",
  ]) {
    assert.match(accessMigration, new RegExp(`'${role}'`));
  }

  assert.match(accessUi, /mfa\.enroll/);
  assert.match(accessUi, /mfa\.challenge/);
  assert.match(accessServer, /authorizeRequest/);
  assert.match(userApi, /auth\.admin\.createUser/);
  assert.match(userApi, /email_confirm: true/);
  assert.match(userApi, /auth\.admin\.deleteUser/);
  assert.doesNotMatch(userApi, /inviteUserByEmail/);
  assert.match(managedUserApi, /platform\.users\.manage/);
  assert.match(managedUserApi, /auth\.admin\.updateUserById/);
  assert.match(managedUserApi, /access_manage_user/);
  assert.match(managedUserApi, /access_record_password_change/);
  assert.match(accessMigration, /access_bootstrap_super_admin/);
  assert.match(accessMigration, /force row level security/);
  assert.match(accessMigration, /audit_events/);
  assert.match(bootstrapMigration, /pg_advisory_xact_lock/);
  assert.match(bootstrapMigration, /active_super_admins >= 2/);
  assert.match(bootstrapMigration, /to service_role/);
  assert.match(managementMigration, /access_control\.has_role\('super_admin'\)/);
  assert.match(managementMigration, /No puedes desactivar tu propia cuenta/);
  assert.match(managementMigration, /password_changed_by_admin/);
  assert.match(managementMigration, /revoke all on function public\.access_manage_user/);
  assert.match(bootstrapScript, /inviteUserByEmail/);
  assert.match(bootstrapScript, /\?access=1/);
  assert.match(accessUi, /Crear usuario y asignar acceso/);
  assert.match(accessUi, /Ver y administrar/);
  assert.match(accessUi, /Cambiar contraseña/);
  assert.match(accessUi, /Desactivar usuario/);
  assert.match(accessUi, /Cargo de planta según organigrama/);
  assert.match(accessUi, /positions\.filter/);
  assert.doesNotMatch(`${accessUi}\n${accessServer}\n${userApi}`, /service_role|HEALTH_SUPABASE_SECRET_KEY/);
});

test("keeps the health database private and server-only", async () => {
  const [healthClient, medicalService, coreMigration, portalMigration] = await Promise.all([
    readFile(new URL("../db/health-index.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/fichas-medicas.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../supabase/migrations/20260824183927_health_core.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../supabase/migrations/20260824185123_health_portal_api.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(healthClient, /HEALTH_SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(healthClient, /NEXT_PUBLIC_/);
  assert.match(medicalService, /health_portal_panel/);
  assert.match(medicalService, /health_create_appointment/);
  assert.match(coreMigration, /create schema if not exists health/);
  assert.match(coreMigration, /force row level security/);
  assert.match(coreMigration, /audit_events_immutable/);
  assert.match(portalMigration, /revoke all on function public\.health_portal_panel/);
  assert.match(portalMigration, /grant execute on function public\.health_portal_panel\(\) to service_role/);
  assert.doesNotMatch(`${healthClient}\n${medicalService}`, /postgresql:\/\//i);
});

test("uses the premium green and gold visual system", async () => {
  const [layout, theme, manifest] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/premium-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /import "\.\/premium-theme\.css"/);
  assert.match(theme, /--navy: #123b28/);
  assert.match(theme, /--yellow: #f0d45d/);
  assert.doesNotMatch(theme, /#071247|#079bd6|#4a44a5|#17297d/i);
  assert.match(manifest, /"theme_color": "#123b28"/);
});
