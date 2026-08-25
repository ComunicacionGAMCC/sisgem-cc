import { NextRequest, NextResponse } from "next/server";
import { crearFichaMedica, obtenerPanelFichasMedicas } from "../../../db/fichas-medicas";
import { AccessDeniedError, authorizeRequest } from "../../../db/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function texto(value: unknown, maximo: number) {
  return typeof value === "string" ? value.trim().slice(0, maximo) : "";
}

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(request, "health.appointments.read");
    const data = await obtenerPanelFichasMedicas();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo obtener la agenda médica", error);
    return NextResponse.json(
      { error: "La agenda médica no está disponible temporalmente." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = {
      solicitudId: texto(body.solicitudId, 64),
      especialidadId: texto(body.especialidadId, 50),
      cupoId: texto(body.cupoId, 50),
      nombrePaciente: texto(body.nombrePaciente, 220),
      documento: texto(body.documento, 40).replace(/\s+/g, ""),
      telefono: texto(body.telefono, 40),
      fechaNacimiento: texto(body.fechaNacimiento, 10),
      consentimiento: body.consentimiento === true,
    };

    if (!/^[0-9a-f-]{36}$/i.test(input.solicitudId)) {
      return NextResponse.json({ error: "La solicitud no tiene un identificador válido." }, { status: 400 });
    }
    if (!input.especialidadId || !input.cupoId) {
      return NextResponse.json({ error: "Selecciona una especialidad y una fecha disponible." }, { status: 400 });
    }
    if (input.nombrePaciente.length < 5) {
      return NextResponse.json({ error: "Ingresa el nombre completo del paciente." }, { status: 400 });
    }
    if (!/^[A-Za-z0-9.-]{4,20}$/.test(input.documento)) {
      return NextResponse.json({ error: "Ingresa un número de documento válido." }, { status: 400 });
    }
    if (!/^[+0-9 ()-]{7,20}$/.test(input.telefono)) {
      return NextResponse.json({ error: "Ingresa un teléfono válido." }, { status: 400 });
    }
    if (input.fechaNacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(input.fechaNacimiento)) {
      return NextResponse.json({ error: "La fecha de nacimiento no es válida." }, { status: 400 });
    }
    if (!input.consentimiento) {
      return NextResponse.json({ error: "Debes autorizar el uso de los datos para emitir la ficha." }, { status: 400 });
    }

    const item = await crearFichaMedica(input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo emitir la ficha médica.";
    const known = /disponib|agot|selecciona|cupos/i.test(message);
    if (!known) console.error("No se pudo crear la ficha médica", error);
    return NextResponse.json(
      { error: known ? message : "No se pudo emitir la ficha médica. Inténtalo nuevamente." },
      { status: known ? 409 : 500 },
    );
  }
}
