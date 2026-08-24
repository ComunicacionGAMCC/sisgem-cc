import { NextRequest, NextResponse } from "next/server";
import {
  crearHojaDeRuta,
  listarHojasDeRuta,
  type FiltroHojas,
  type NuevaHojaRuta,
} from "../../../db/hojas-ruta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const buscar = request.nextUrl.searchParams.get("buscar") ?? "";
    const filtroParam = request.nextUrl.searchParams.get("filtro") ?? "todos";
    const filtro: FiltroHojas = ["todos", "pendientes", "finalizados"].includes(filtroParam)
      ? (filtroParam as FiltroHojas)
      : "todos";
    const items = await listarHojasDeRuta({ buscar, filtro });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("No se pudieron listar las hojas de ruta", error);
    return NextResponse.json({ error: "Base de datos no disponible." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<NuevaHojaRuta>;
    if (!body.remitente?.trim() || !body.asunto?.trim() || !body.unidadCodigo?.trim()) {
      return NextResponse.json(
        { error: "Remitente, asunto y unidad de destino son obligatorios." },
        { status: 400 },
      );
    }

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
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear la hoja de ruta", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la hoja de ruta." },
      { status: 500 },
    );
  }
}
