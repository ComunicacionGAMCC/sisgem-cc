import { NextRequest, NextResponse } from "next/server";
import { obtenerSeguimiento } from "../../../../db/hojas-ruta";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ codigo: string }> },
) {
  try {
    const { codigo } = await context.params;
    const item = await obtenerSeguimiento(decodeURIComponent(codigo));
    if (!item) {
      return NextResponse.json({ error: "No existe una solicitud con ese código." }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    console.error("No se pudo consultar el seguimiento", error);
    return NextResponse.json({ error: "No se pudo consultar el seguimiento." }, { status: 503 });
  }
}
