import { NextRequest, NextResponse } from "next/server";
import {
  decideAgendaAttendance,
  type AgendaAttendanceDecision,
} from "../../../../../db/agenda";
import {
  AccessDeniedError,
  authorizeRequest,
  requireCabinetAgendaDecision,
} from "../../../../../db/access-control";
import { listarDelegadosAgendaActivos } from "../../../../../db/unidades";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { context } = await authorizeRequest(request);
    requireCabinetAgendaDecision(context);
    const { id } = await params;
    if (!uuidPattern.test(id)) {
      return NextResponse.json({ error: "La actividad indicada no es válida." }, { status: 400 });
    }

    const body = (await request.json()) as Partial<AgendaAttendanceDecision>;
    if (body.attendance !== "alcalde" && body.attendance !== "designado") {
      return NextResponse.json({ error: "Selecciona quién asistirá a la actividad." }, { status: 400 });
    }

    let delegatePositionCode: string | null = null;
    let delegatePositionName: string | null = null;
    let delegateUnitName: string | null = null;
    if (body.attendance === "designado") {
      const code = body.delegatePositionCode?.trim() ?? "";
      const allowedPositions = await listarDelegadosAgendaActivos();
      const selected = allowedPositions.find((position) => position.code === code);
      if (!selected) {
        return NextResponse.json(
          { error: "Selecciona al Secretario Municipal o a un director de área válido." },
          { status: 400 },
        );
      }
      delegatePositionCode = selected.code;
      delegatePositionName = selected.name;
      delegateUnitName = selected.unitName;
    }

    const result = await decideAgendaAttendance(id, {
      attendance: body.attendance,
      delegatePositionCode,
      delegatePositionName,
      delegateUnitName,
    }, {
      userId: context.profile.id,
      name: context.profile.fullName,
    });
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "La actividad ya no existe." }, { status: 404 });
    }
    if (result.reason === "cancelled") {
      return NextResponse.json(
        { error: "No se puede confirmar la asistencia a una actividad cancelada." },
        { status: 409 },
      );
    }
    return NextResponse.json({ item: result.item });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo registrar la decisión de asistencia", error);
    return NextResponse.json({ error: "No se pudo guardar la decisión de asistencia." }, { status: 500 });
  }
}
