import { and, eq } from "drizzle-orm";
import { getDb } from "./index";
import { notificacionesDispositivos, notificacionesEntregas } from "./schema";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type NotificationDevice = typeof notificacionesDispositivos.$inferSelect;

export async function guardarDispositivoNotificaciones(input: {
  userId: string;
  fullName: string;
  jobTitle: string | null;
  roleCodes: string[];
  subscription: PushSubscriptionInput;
}) {
  const db = getDb();
  const now = new Date();
  const [device] = await db
    .insert(notificacionesDispositivos)
    .values({
      usuarioId: input.userId,
      endpoint: input.subscription.endpoint,
      claveP256dh: input.subscription.keys.p256dh,
      claveAuth: input.subscription.keys.auth,
      nombreCompleto: input.fullName,
      cargo: input.jobTitle,
      roles: input.roleCodes,
      activo: true,
      ultimoAccesoAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: notificacionesDispositivos.endpoint,
      set: {
        usuarioId: input.userId,
        claveP256dh: input.subscription.keys.p256dh,
        claveAuth: input.subscription.keys.auth,
        nombreCompleto: input.fullName,
        cargo: input.jobTitle,
        roles: input.roleCodes,
        activo: true,
        ultimoAccesoAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return device;
}

export async function desactivarDispositivoUsuario(userId: string, endpoint: string) {
  const db = getDb();
  const [device] = await db
    .update(notificacionesDispositivos)
    .set({ activo: false, updatedAt: new Date() })
    .where(and(
      eq(notificacionesDispositivos.usuarioId, userId),
      eq(notificacionesDispositivos.endpoint, endpoint),
    ))
    .returning({ id: notificacionesDispositivos.id });
  return Boolean(device);
}

export async function listarDispositivosActivos() {
  return getDb()
    .select()
    .from(notificacionesDispositivos)
    .where(eq(notificacionesDispositivos.activo, true));
}

export async function desactivarDispositivo(id: string) {
  await getDb()
    .update(notificacionesDispositivos)
    .set({ activo: false, updatedAt: new Date() })
    .where(eq(notificacionesDispositivos.id, id));
}

export async function reclamarEntrega(input: {
  deviceId: string;
  activityId?: string | null;
  dedupeKey: string;
  type: string;
  scheduledFor?: Date | null;
}) {
  const [delivery] = await getDb()
    .insert(notificacionesEntregas)
    .values({
      dispositivoId: input.deviceId,
      actividadId: input.activityId ?? null,
      claveUnica: input.dedupeKey,
      tipo: input.type,
      programadaAt: input.scheduledFor ?? null,
    })
    .onConflictDoNothing({ target: notificacionesEntregas.claveUnica })
    .returning({ id: notificacionesEntregas.id });
  return delivery?.id ?? null;
}

export async function marcarEntregaEnviada(id: string) {
  await getDb()
    .update(notificacionesEntregas)
    .set({ estado: "enviada", enviadaAt: new Date(), error: null, updatedAt: new Date() })
    .where(eq(notificacionesEntregas.id, id));
}

export async function marcarEntregaFallida(id: string, error: string) {
  await getDb()
    .update(notificacionesEntregas)
    .set({ estado: "fallida", error: error.slice(0, 2_000), updatedAt: new Date() })
    .where(eq(notificacionesEntregas.id, id));
}
