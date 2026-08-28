import { NextRequest, NextResponse } from "next/server";
import {
  type AccionHojaRuta,
  gestionarHojaRuta,
  HojaRutaAccessError,
  obtenerDetalleHojaRuta,
} from "../../../../db/hojas-ruta";
import {
  AccessDeniedError,
  authorizeRequest,
  scopedMunicipalUnitIds,
} from "../../../../db/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof HojaRutaAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
  const message = error instanceof Error ? error.message : fallback;
  const known = /no existe|otra unidad|asignada|cerrada|archiv|finaliz|reabr|destino|fecha|activa/i.test(message);
  if (!known) console.error(fallback, error);
  return NextResponse.json({ error: known ? message : fallback }, { status: known ? 409 : 500 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ error: "La hoja de ruta no es válida." }, { status: 400 });
    const { context } = await authorizeRequest(request, "sigem.routes.read");
    const item = await obtenerDetalleHojaRuta(id, scopedMunicipalUnitIds(context));
    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "No se pudo consultar la hoja de ruta.");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ error: "La hoja de ruta no es válida." }, { status: 400 });
    const body = (await request.json()) as Record<string, unknown>;
    const type = cleanText(body.type, 30);
    const permission = type === "receive"
      ? "sigem.routes.receive"
      : type === "derive"
        ? "sigem.routes.route"
        : ["close", "archive", "reopen"].includes(type)
          ? "sigem.routes.close"
          : "sigem.routes.update";
    const { context } = await authorizeRequest(request, permission);
    const detail = cleanText(body.detail, 2_000);
    let action: AccionHojaRuta;

    if (type === "receive") {
      action = { type, note: cleanText(body.note, 500) };
    } else if (type === "derive") {
      const destinationUnitId = cleanText(body.destinationUnitId, 36);
      const note = cleanText(body.note, 1_000);
      if (!uuidPattern.test(destinationUnitId) || note.length < 5) {
        return NextResponse.json({ error: "Selecciona la unidad de destino e indica el motivo de la derivación." }, { status: 400 });
      }
      action = { type, destinationUnitId, note };
    } else if (type === "act") {
      const title = cleanText(body.title, 220);
      if (title.length < 3 || detail.length < 3) {
        return NextResponse.json({ error: "Escribe el título y detalle de la actuación." }, { status: 400 });
      }
      action = { type, title, detail, public: body.public === true };
    } else if (type === "observe") {
      if (detail.length < 5) return NextResponse.json({ error: "Describe el motivo de la observación." }, { status: 400 });
      action = { type, detail, public: body.public === true };
    } else if (type === "deadline") {
      const dueAt = cleanText(body.dueAt, 10);
      if (!datePattern.test(dueAt)) return NextResponse.json({ error: "Selecciona una fecha límite válida." }, { status: 400 });
      action = { type, dueAt, detail };
    } else if (type === "close") {
      if (detail.length < 5) return NextResponse.json({ error: "Registra la respuesta o resultado antes de cerrar." }, { status: 400 });
      action = { type, detail, public: body.public !== false };
    } else if (type === "archive") {
      action = { type, detail };
    } else if (type === "reopen") {
      if (detail.length < 5) return NextResponse.json({ error: "Indica el motivo de la reapertura." }, { status: 400 });
      action = { type, detail };
    } else {
      return NextResponse.json({ error: "La actuación solicitada no existe." }, { status: 400 });
    }

    const item = await gestionarHojaRuta(id, action, {
      userId: context.profile.id,
      name: context.profile.fullName,
    }, scopedMunicipalUnitIds(context));
    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error, "No se pudo registrar la actuación.");
  }
}
