import { NextResponse } from "next/server";
import { obtenerDisponibilidadPublica } from "../../../../db/fichas-medicas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await obtenerDisponibilidadPublica();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("No se pudo obtener la disponibilidad médica", error);
    return NextResponse.json(
      { error: "La disponibilidad médica no está disponible temporalmente." },
      { status: 503 },
    );
  }
}
