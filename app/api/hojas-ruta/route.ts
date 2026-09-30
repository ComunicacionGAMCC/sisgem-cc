import { NextRequest, NextResponse } from "next/server";
import {
  crearHojaDeRuta,
  listarHojasDeRuta,
  type FiltroHojas,
  type NuevaHojaRuta,
  type TipoHojaRuta,
} from "../../../db/hojas-ruta";
import {
  AccessDeniedError,
  authorizeRequest,
  scopedMunicipalUnitIds,
} from "../../../db/access-control";

export const dynamic = "force-dynamic";

const tiposPermitidos = new Set<TipoHojaRuta>([
  "solicitud_externa",
  "solicitud_audiencia",
  "comunicacion_interna",
]);

export async function GET(request: NextRequest) {
  try {
    const { context } = await authorizeRequest(request, "sigem.routes.read");
    const buscar = request.nextUrl.searchParams.get("buscar") ?? "";
    const filtroParam = request.nextUrl.searchParams.get("filtro") ?? "todos";
    const filtro: FiltroHojas = ["todos", "pendientes", "finalizados"].includes(filtroParam)
      ? (filtroParam as FiltroHojas)
      : "todos";
    const items = await listarHojasDeRuta({
      buscar,
      filtro,
      unidadIds: scopedMunicipalUnitIds(context),
    });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudieron listar las hojas de ruta", error);
    return NextResponse.json({ error: "Base de datos no disponible." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context } = await authorizeRequest(request, "sigem.routes.create");
    const body = (await request.json()) as Partial<NuevaHojaRuta>;
    if (!body.remitente?.trim() || !body.consignatario?.trim() || !body.asunto?.trim()) {
      return NextResponse.json(
        { error: "Remitente, consignatario y asunto son obligatorios." },
        { status: 400 },
      );
    }
    const tipo = body.tipo ?? "solicitud_externa";
    if (!tiposPermitidos.has(tipo)) {
      return NextResponse.json({ error: "Selecciona un tipo de solicitud válido." }, { status: 400 });
    }
    const esComunicacionInterna = tipo === "comunicacion_interna";
    if (!esComunicacionInterna && !body.telefono?.trim()) {
      return NextResponse.json(
        { error: "El número de teléfono es obligatorio para solicitudes externas y de audiencia." },
        { status: 400 },
      );
    }
    if (!esComunicacionInterna && body.email?.trim() && !/^\S+@\S+\.\S+$/.test(body.email.trim())) {
      return NextResponse.json({ error: "El correo electrónico no es válido." }, { status: 400 });
    }

    const item = await crearHojaDeRuta({
      remitente: body.remitente,
      consignatario: body.consignatario,
      asunto: body.asunto,
      tipo,
      prioridad: body.prioridad,
      telefono: esComunicacionInterna ? undefined : body.telefono,
      email: esComunicacionInterna ? undefined : body.email,
    }, {
      userId: context.profile.id,
      name: context.profile.fullName,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo crear la hoja de ruta", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la hoja de ruta." },
      { status: 500 },
    );
  }
}
