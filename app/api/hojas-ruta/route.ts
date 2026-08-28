import { NextRequest, NextResponse } from "next/server";
import {
  crearHojaDeRuta,
  listarHojasDeRuta,
  type FiltroHojas,
  type NuevaHojaRuta,
} from "../../../db/hojas-ruta";
import { listarUnidadesActivas } from "../../../db/unidades";
import {
  AccessDeniedError,
  authorizeRequest,
  scopedMunicipalUnitIds,
} from "../../../db/access-control";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { context } = await authorizeRequest(request, "sigem.routes.read");
    const buscar = request.nextUrl.searchParams.get("buscar") ?? "";
    const filtroParam = request.nextUrl.searchParams.get("filtro") ?? "todos";
    const filtro: FiltroHojas = ["todos", "pendientes", "finalizados"].includes(filtroParam)
      ? (filtroParam as FiltroHojas)
      : "todos";
    const [items, units] = await Promise.all([
      listarHojasDeRuta({
        buscar,
        filtro,
        unidadIds: scopedMunicipalUnitIds(context),
      }),
      listarUnidadesActivas(),
    ]);
    return NextResponse.json({ items, units });
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
    if (!body.remitente?.trim() || !body.asunto?.trim() || !body.unidadCodigo?.trim()) {
      return NextResponse.json(
        { error: "Remitente, asunto y unidad de destino son obligatorios." },
        { status: 400 },
      );
    }

    const scopedUnits = scopedMunicipalUnitIds(context);
    const item = await crearHojaDeRuta({
      remitente: body.remitente,
      asunto: body.asunto,
      descripcion: body.descripcion,
      tipo: body.tipo,
      prioridad: body.prioridad,
      unidadCodigo: body.unidadCodigo,
      documento: body.documento,
      telefono: body.telefono,
      email: body.email,
    }, {
      userId: context.profile.id,
      name: context.profile.fullName,
      unitId: scopedUnits?.length === 1 ? scopedUnits[0] : null,
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
