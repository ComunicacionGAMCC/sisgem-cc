import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError, authorizeRequest } from "../../../db/access-control";
import { actualizarEstadoContratacion, crearContratacion, listarContrataciones } from "../../../db/contrataciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const modalities = new Set(["menor", "anpe", "licitacion_publica", "directa", "excepcion"]);
const statuses = new Set(["preparacion", "certificacion", "convocatoria", "evaluacion", "adjudicado", "contrato", "ejecucion", "pago", "concluido", "cancelado"]);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function handleError(error: unknown) {
  if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("No se pudo procesar Contrataciones", error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "El módulo de Contrataciones no está disponible." }, { status: 503 });
}

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(request, "sigem.routes.read");
    return NextResponse.json(await listarContrataciones(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 30);
    const permission = action === "create" ? "sigem.routes.create" : "sigem.routes.update";
    const { context } = await authorizeRequest(request, permission);
    const actor = { id: context.profile.id, name: context.profile.fullName };

    if (action === "create") {
      const object = text(body.object, 300);
      const modality = text(body.modality, 60);
      const amountNumber = Number(body.amount);
      const unitId = text(body.unitId, 36);
      const responsible = text(body.responsible, 220) || null;
      const startDate = text(body.startDate, 10);
      const deadline = text(body.deadline, 10) || null;
      if (object.length < 5 || !modalities.has(modality) || !unitId || !isoDate.test(startDate) || (deadline && !isoDate.test(deadline)) || !Number.isFinite(amountNumber) || amountNumber < 0) {
        return NextResponse.json({ error: "Revisa el objeto, modalidad, área, fechas y monto del proceso." }, { status: 400 });
      }
      const item = await crearContratacion({ object, modality, amount: amountNumber.toFixed(2), unitId, responsible, startDate, deadline, actor });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (action === "set_status") {
      const id = text(body.id, 36);
      const status = text(body.status, 40);
      const detail = text(body.detail, 1000) || null;
      if (!id || !statuses.has(status)) return NextResponse.json({ error: "El estado seleccionado no es válido." }, { status: 400 });
      return NextResponse.json({ item: await actualizarEstadoContratacion({ id, status, detail, actor }) });
    }

    return NextResponse.json({ error: "Acción de contratación no reconocida." }, { status: 400 });
  } catch (error) {
    return handleError(error);
  }
}
