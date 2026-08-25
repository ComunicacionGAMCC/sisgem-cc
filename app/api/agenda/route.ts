import { NextRequest, NextResponse } from "next/server";
import { createAgendaActivity, listAgendaActivities, type NewAgendaActivity } from "../../../db/agenda";
import {
  AccessDeniedError,
  authorizeRequest,
  requireCabinetAgendaAccess,
  requireCabinetAgendaManagement,
} from "../../../db/access-control";

export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function GET(request: NextRequest) {
  try {
    const { context } = await authorizeRequest(request);
    requireCabinetAgendaAccess(context);
    const from = request.nextUrl.searchParams.get("from") ?? "";
    const to = request.nextUrl.searchParams.get("to") ?? from;
    if (!datePattern.test(from) || !datePattern.test(to) || from > to) {
      return NextResponse.json({ error: "Selecciona un rango de fechas válido." }, { status: 400 });
    }
    const items = await listAgendaActivities(from, to);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo consultar la agenda del alcalde", error);
    return NextResponse.json({ error: "La agenda no está disponible temporalmente." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context } = await authorizeRequest(request);
    requireCabinetAgendaManagement(context);
    const body = (await request.json()) as Partial<NewAgendaActivity>;
    const date = body.date?.trim() ?? "";
    const startTime = body.startTime?.trim() ?? "";
    const endTime = body.endTime?.trim() || null;
    const title = body.title?.trim() ?? "";
    const place = body.place?.trim() || null;
    const description = body.description?.trim() || null;
    const status = body.status === "tentativa" ? "tentativa" : "confirmada";

    if (!datePattern.test(date) || !timePattern.test(startTime)) {
      return NextResponse.json({ error: "La fecha y hora de inicio son obligatorias." }, { status: 400 });
    }
    if (endTime && (!timePattern.test(endTime) || endTime <= startTime)) {
      return NextResponse.json({ error: "La hora final debe ser posterior a la hora de inicio." }, { status: 400 });
    }
    if (title.length < 3 || title.length > 220 || (place?.length ?? 0) > 220 || (description?.length ?? 0) > 2_000) {
      return NextResponse.json({ error: "Revisa el título, lugar y descripción de la actividad." }, { status: 400 });
    }

    const item = await createAgendaActivity({
      date,
      startTime,
      endTime,
      title,
      place,
      description,
      status,
      createdByUserId: context.profile.id,
      createdByName: context.profile.fullName,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo registrar la actividad del alcalde", error);
    return NextResponse.json({ error: "No se pudo guardar la actividad." }, { status: 500 });
  }
}
