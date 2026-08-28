import { NextRequest } from "next/server";
import { AccessDeniedError, authorizeRequest, scopedMunicipalUnitIds } from "../../../../../../db/access-control";
import { HojaRutaAccessError, obtenerAdjuntoHojaRuta } from "../../../../../../db/hojas-ruta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const { id, attachmentId } = await params;
    if (!uuidPattern.test(id) || !uuidPattern.test(attachmentId)) {
      return Response.json({ error: "El documento no es válido." }, { status: 400 });
    }
    const { context } = await authorizeRequest(request, "sigem.routes.read");
    const attachment = await obtenerAdjuntoHojaRuta(id, attachmentId, scopedMunicipalUnitIds(context));
    const bytes = Buffer.from(attachment.base64, "base64");
    const name = attachment.name.replace(/["\r\n]/g, "_");
    return new Response(bytes, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof HojaRutaAccessError) return Response.json({ error: error.message }, { status: 403 });
    const message = error instanceof Error ? error.message : "No se pudo descargar el documento.";
    return Response.json({ error: /no existe/i.test(message) ? message : "No se pudo descargar el documento." }, { status: /no existe/i.test(message) ? 404 : 500 });
  }
}
