import { obtenerAdjuntoPublico } from "../../../../../../db/hojas-ruta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern = /^HR-\d{4}-\d{5}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ codigo: string; attachmentId: string }> }) {
  try {
    const { codigo, attachmentId } = await params;
    const normalizedCode = decodeURIComponent(codigo).trim().toUpperCase();
    if (!codePattern.test(normalizedCode) || !uuidPattern.test(attachmentId)) return Response.json({ error: "El documento no es válido." }, { status: 400 });
    const attachment = await obtenerAdjuntoPublico(normalizedCode, attachmentId);
    const bytes = Buffer.from(attachment.base64, "base64");
    const name = attachment.name.replace(/["\r\n]/g, "_");
    return new Response(bytes, { headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "El documento no existe o no es público." }, { status: 404 });
  }
}
