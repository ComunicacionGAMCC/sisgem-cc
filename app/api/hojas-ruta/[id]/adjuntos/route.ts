import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError, authorizeRequest, scopedMunicipalUnitIds } from "../../../../../db/access-control";
import { guardarAdjuntoHojaRuta, HojaRutaAccessError } from "../../../../../db/hojas-ruta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumSize = 3 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeName(name: string) {
  return Array.from(name.replace(/[\\/:*?"<>|]/g, "_"))
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .slice(0, 240);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ error: "La hoja de ruta no es válida." }, { status: 400 });
    const { context } = await authorizeRequest(request, "sigem.routes.update");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona un documento." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Solo se admiten PDF, imágenes, Word y Excel." }, { status: 415 });
    if (file.size < 1 || file.size > maximumSize) return NextResponse.json({ error: "El documento debe pesar como máximo 3 MB." }, { status: 413 });
    const name = safeName(file.name);
    if (!name) return NextResponse.json({ error: "El nombre del documento no es válido." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const item = await guardarAdjuntoHojaRuta({
      hojaRutaId: id,
      name,
      mimeType: file.type,
      size: file.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      base64: bytes.toString("base64"),
      public: ["true", "on", "1"].includes(String(form.get("public") ?? "")),
      actor: { userId: context.profile.id, name: context.profile.fullName },
      unitIds: scopedMunicipalUnitIds(context),
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof HojaRutaAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    const message = error instanceof Error ? error.message : "No se pudo guardar el documento.";
    const known = /no existe|otra unidad|archivado/i.test(message);
    if (!known) console.error("No se pudo guardar el adjunto", error);
    return NextResponse.json({ error: known ? message : "No se pudo guardar el documento." }, { status: known ? 409 : 500 });
  }
}
