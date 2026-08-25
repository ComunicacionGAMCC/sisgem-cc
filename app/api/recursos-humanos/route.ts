import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError, authorizeRequest } from "../../../db/access-control";
import {
  actualizarCargoRrhh,
  cambiarEstadoPersonalRrhh,
  crearCargoRrhh,
  crearPersonalRrhh,
  crearPlanillaRrhh,
  moverPersonalRrhh,
  obtenerPanelRecursosHumanos,
  registrarDescuentoRrhh,
} from "../../../db/recursos-humanos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const employmentTypes = new Set(["planta", "consultor_linea", "contrato"]);
const discountTypes = new Set(["afp", "rc_iva", "anticipo", "falta", "otro"]);

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : "";
}

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(request, "sigem.hr.read");
    const data = await obtenerPanelRecursosHumanos();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("No se pudo consultar Recursos Humanos", error);
    return NextResponse.json({ error: "El panel de Recursos Humanos no está disponible." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 40);
    const permission = action === "create_payroll" || action === "add_discount"
      ? "sigem.hr.payroll"
      : "sigem.hr.manage";
    const { context } = await authorizeRequest(request, permission);
    const actor = { id: context.profile.id, name: context.profile.fullName };

    if (action === "create_position") {
      const code = text(body.code, 40).toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const name = text(body.name, 240);
      const unitId = text(body.unitId, 36);
      const employmentType = text(body.employmentType, 30);
      const baseSalary = money(body.baseSalary);
      if (code.length < 3 || name.length < 4 || !unitId || !employmentTypes.has(employmentType) || !baseSalary) {
        return NextResponse.json({ error: "Revisa el código, área, tipo de vínculo y haber básico." }, { status: 400 });
      }
      return NextResponse.json({ item: await crearCargoRrhh({ code, name, unitId, employmentType, baseSalary }) }, { status: 201 });
    }

    if (action === "update_position") {
      const id = integer(body.id);
      const name = text(body.name, 240);
      const unitId = text(body.unitId, 36);
      const employmentType = text(body.employmentType, 30);
      const baseSalary = money(body.baseSalary);
      if (!id || name.length < 4 || !unitId || !employmentTypes.has(employmentType) || !baseSalary) {
        return NextResponse.json({ error: "Los datos del cargo no son válidos." }, { status: 400 });
      }
      return NextResponse.json({ item: await actualizarCargoRrhh({ id, name, unitId, employmentType, baseSalary, active: body.active !== false }) });
    }

    if (action === "create_staff") {
      const document = text(body.document, 40).replace(/\s+/g, "");
      const firstNames = text(body.firstNames, 120);
      const lastNames = text(body.lastNames, 160);
      const positionId = integer(body.positionId);
      const employmentType = text(body.employmentType, 30);
      const startDate = text(body.startDate, 10);
      const contractEndDate = text(body.contractEndDate, 10) || null;
      if (document.length < 4 || firstNames.length < 2 || lastNames.length < 2 || !positionId
        || !employmentTypes.has(employmentType) || !isoDate.test(startDate)
        || (contractEndDate && !isoDate.test(contractEndDate))) {
        return NextResponse.json({ error: "Completa correctamente los datos laborales del servidor." }, { status: 400 });
      }
      return NextResponse.json({ item: await crearPersonalRrhh({
        document, firstNames, lastNames, positionId, employmentType, startDate, contractEndDate,
        email: text(body.email, 240) || null, phone: text(body.phone, 40) || null,
      }) }, { status: 201 });
    }

    if (action === "move_staff") {
      const staffId = integer(body.staffId);
      const positionId = integer(body.positionId);
      const reason = text(body.reason, 500);
      const effectiveDate = text(body.effectiveDate, 10);
      if (!staffId || !positionId || reason.length < 5 || !isoDate.test(effectiveDate)) {
        return NextResponse.json({ error: "Indica la persona, el nuevo cargo, la fecha y el motivo." }, { status: 400 });
      }
      return NextResponse.json({ item: await moverPersonalRrhh({ staffId, positionId, reason, effectiveDate, actor }) });
    }

    if (action === "set_staff_active") {
      const staffId = integer(body.staffId);
      if (!staffId) return NextResponse.json({ error: "Selecciona una persona." }, { status: 400 });
      return NextResponse.json({ item: await cambiarEstadoPersonalRrhh(staffId, body.active === true) });
    }

    if (action === "create_payroll") {
      const year = integer(body.year);
      const month = integer(body.month);
      if (year < 2020 || year > 2100 || month < 1 || month > 12) {
        return NextResponse.json({ error: "Selecciona un periodo de planilla válido." }, { status: 400 });
      }
      return NextResponse.json({ item: await crearPlanillaRrhh(year, month, actor) }, { status: 201 });
    }

    if (action === "add_discount") {
      const payrollItemId = integer(body.payrollItemId);
      const type = text(body.type, 30);
      const concept = text(body.concept, 180);
      const amount = money(body.amount);
      if (!payrollItemId || !discountTypes.has(type) || concept.length < 3 || !amount || Number(amount) <= 0) {
        return NextResponse.json({ error: "Revisa el concepto, tipo y monto del descuento." }, { status: 400 });
      }
      return NextResponse.json({ item: await registrarDescuentoRrhh({ payrollItemId, type, concept, amount }) }, { status: 201 });
    }

    return NextResponse.json({ error: "La operación solicitada no existe." }, { status: 400 });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "No se pudo completar la operación.";
    const known = /existe|duplic|unique|periodo|servidor|fila/i.test(message);
    if (!known) console.error("No se pudo actualizar Recursos Humanos", error);
    return NextResponse.json({ error: known ? message : "No se pudo guardar la información de Recursos Humanos." }, { status: known ? 409 : 500 });
  }
}
