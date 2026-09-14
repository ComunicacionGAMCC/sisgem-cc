import { NextRequest, NextResponse } from "next/server";
import {
  deleteAgendaActivity,
  updateAgendaActivity,
  type AgendaActivityStatus,
  type UpdateAgendaActivity,
} from "../../../../db/agenda";
import {
  AccessDeniedError,
  authorizeRequest,
  requireCabinetAgendaManagement,
} from "../../../../db/access-control";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const validStatuses = new Set<AgendaActivityStatus>(["confirmada", "tentativa", "cancelada"]);

function validateActivity(body: Partial<UpdateAgendaActivity>) {
  const date = body.date?.trim() ?? "";
  const startTime = body.startTime?.trim() ?? "";
  const endTime = body.endTime?.trim() || null;
  const title = body.title?.trim() ?? "";
  const place = body.place?.trim() || null;
  const description = body.description?.trim() || null;
  const status = body.status ?? "confirmada";

  if (!datePattern.test(date) || !timePattern.test(startTime)) {
    return { error: "La fecha y hora de inicio son obligatorias." } as const;
  }
  if (endTime && (!timePattern.test(endTime) || endTime <= startTime)) {
    return { error: "La hora final debe ser posterior a la hora de inicio." } as const;
  }
  if (!validStatuses.has(status) || title.length < 3 || title.length > 220
    || (place?.length ?? 0) > 220 || (description?.length ?? 0) > 2_000) {
    return { error: "Revisa el título, lugar, descripción y estado de la actividad." } as const;
  }

  return { value: { date, startTime, endTime, title, place, description, status } } as const;
}

function validId(id: string) {
  return uuidPattern.test(id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { context } = await authorizeRequest(request);
    requireCabinetAgendaManagement(context);
    const { id } = await params;
    if (!validId(id)) return NextResponse.json({ error: "La actividad indicada no es válida." }, { status: 400 });

    const parsed = validateActivity((await request.json()) as Partial<UpdateAgendaActivity>);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const item = await updateAgendaActivity(id, parsed.value, {
      userId: context.profile.id,
      name: context.profile.fullName,
    });
    if (!item) return NextResponse.json({ error: "La actividad ya no existe." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo actualizar la actividad del alcalde", error);
    return NextResponse.json({ error: "No se pudo actualizar la actividad." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { context } = await authorizeRequest(request);
    requireCabinetAgendaManagement(context);
    const { id } = await params;
    if (!validId(id)) return NextResponse.json({ error: "La actividad indicada no es válida." }, { status: 400 });

    const deleted = await deleteAgendaActivity(id, {
      userId: context.profile.id,
      name: context.profile.fullName,
    });
    if (!deleted) return NextResponse.json({ error: "La actividad ya no existe." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo eliminar la actividad del alcalde", error);
    return NextResponse.json({ error: "No se pudo eliminar la actividad." }, { status: 500 });
  }
}
