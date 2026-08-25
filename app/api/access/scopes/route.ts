import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError, authorizeRequest } from "../../../../db/access-control";
import { listarCargosOrganigramaActivos, listarUnidadesActivas } from "../../../../db/unidades";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(request, "sigem.users.manage");
    const [units, positions] = await Promise.all([
      listarUnidadesActivas(),
      listarCargosOrganigramaActivos(),
    ]);
    return NextResponse.json({ units, positions });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "No se pudieron consultar las áreas municipales." }, { status: 503 });
  }
}
