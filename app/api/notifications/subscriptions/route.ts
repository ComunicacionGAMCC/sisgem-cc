import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError, authorizeRequest } from "../../../../db/access-control";
import {
  desactivarDispositivoUsuario,
  guardarDispositivoNotificaciones,
  type PushSubscriptionInput,
} from "../../../../db/notificaciones";

export const dynamic = "force-dynamic";

function validSubscription(value: unknown): value is PushSubscriptionInput {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PushSubscriptionInput>;
  return typeof candidate.endpoint === "string"
    && candidate.endpoint.startsWith("https://")
    && candidate.endpoint.length <= 2_000
    && typeof candidate.keys?.p256dh === "string"
    && candidate.keys.p256dh.length >= 20
    && typeof candidate.keys?.auth === "string"
    && candidate.keys.auth.length >= 8;
}

export async function POST(request: NextRequest) {
  try {
    const { context } = await authorizeRequest(request);
    if (!context.roles.some((role) => role.module === "sigem" || role.module === "platform")) {
      throw new AccessDeniedError("Las notificaciones institucionales requieren un acceso municipal.");
    }
    const body = await request.json() as { subscription?: unknown };
    if (!validSubscription(body.subscription)) {
      return NextResponse.json({ error: "La suscripción del dispositivo no es válida." }, { status: 400 });
    }
    const device = await guardarDispositivoNotificaciones({
      userId: context.profile.id,
      fullName: context.profile.fullName,
      jobTitle: context.profile.jobTitle,
      roleCodes: context.roles.map((role) => role.code),
      subscription: body.subscription,
    });
    return NextResponse.json({ active: true, deviceId: device.id });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo activar el dispositivo para notificaciones", error);
    return NextResponse.json({ error: "No se pudieron activar las notificaciones." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { context } = await authorizeRequest(request);
    if (!context.roles.some((role) => role.module === "sigem" || role.module === "platform")) {
      throw new AccessDeniedError("Las notificaciones institucionales requieren un acceso municipal.");
    }
    const body = await request.json() as { endpoint?: string };
    const endpoint = body.endpoint?.trim() ?? "";
    if (!endpoint.startsWith("https://")) {
      return NextResponse.json({ error: "El dispositivo indicado no es válido." }, { status: 400 });
    }
    await desactivarDispositivoUsuario(context.profile.id, endpoint);
    return NextResponse.json({ active: false });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("No se pudo desactivar el dispositivo", error);
    return NextResponse.json({ error: "No se pudieron desactivar las notificaciones." }, { status: 500 });
  }
}
