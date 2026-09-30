import webpush from "web-push";
import type { AgendaActivity } from "../db/agenda";
import {
  desactivarDispositivo,
  listarDispositivosActivos,
  marcarEntregaEnviada,
  marcarEntregaFallida,
  reclamarEntrega,
  type NotificationDevice,
} from "../db/notificaciones";

type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url?: string;
};

type Audience = "mayor" | "secretario_municipal" | "prensa" | "agenda_principal" | {
  delegatePositionName: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isMayor(device: NotificationDevice) {
  return device.roles.includes("sigem_alcalde") || /(^| )alcalde( |$)/.test(normalize(device.cargo));
}

function isMunicipalSecretary(device: NotificationDevice) {
  return /secretari[oa] municipal/.test(normalize(device.cargo));
}

function isPress(device: NotificationDevice) {
  return device.roles.includes("sigem_prensa");
}

function matchesAudience(device: NotificationDevice, audience: Audience) {
  if (audience === "mayor") return isMayor(device);
  if (audience === "secretario_municipal") return isMunicipalSecretary(device);
  if (audience === "prensa") return isPress(device);
  if (audience === "agenda_principal") return isMayor(device) || isMunicipalSecretary(device) || isPress(device);
  const actual = normalize(device.cargo);
  const expected = normalize(audience.delegatePositionName);
  return Boolean(actual && expected && (actual === expected || actual.includes(expected) || expected.includes(actual)));
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
    ?? "BCx8x_9ASuFXr1TqxbATJIHV7JJ72HAcHipYVb7JbSzoENDZvE7bcjG68Kv8fMSYQdbsMXZ0BureJAxQu23lAjs";
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const contact = process.env.WEB_PUSH_CONTACT ?? "mailto:unidadcomunicacion150@gmail.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(contact, publicKey, privateKey);
  return true;
}

function subscriptionFor(device: NotificationDevice) {
  return {
    endpoint: device.endpoint,
    keys: { p256dh: device.claveP256dh, auth: device.claveAuth },
  };
}

export async function sendPushToAudience(input: {
  audience: Audience;
  payload: PushPayload;
  type: string;
  dedupePrefix: string;
  activityId?: string | null;
  scheduledFor?: Date | null;
}) {
  if (!configureWebPush()) {
    console.warn("Web Push no está configurado; se omitió el envío de notificaciones.");
    return { sent: 0, skipped: 0, failed: 0, configured: false };
  }

  const devices = (await listarDispositivosActivos()).filter((device) => matchesAudience(device, input.audience));
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const device of devices) {
    const deliveryId = await reclamarEntrega({
      deviceId: device.id,
      activityId: input.activityId,
      dedupeKey: `${input.dedupePrefix}:${device.id}`,
      type: input.type,
      scheduledFor: input.scheduledFor,
    });
    if (!deliveryId) {
      skipped += 1;
      continue;
    }
    try {
      await webpush.sendNotification(subscriptionFor(device), JSON.stringify(input.payload), { TTL: 3_600 });
      await marcarEntregaEnviada(deliveryId);
      sent += 1;
    } catch (reason) {
      const statusCode = typeof reason === "object" && reason && "statusCode" in reason
        ? Number((reason as { statusCode?: number }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) await desactivarDispositivo(device.id);
      const message = reason instanceof Error ? reason.message : "Fallo desconocido de Web Push";
      await marcarEntregaFallida(deliveryId, message);
      failed += 1;
    }
  }
  return { sent, skipped, failed, configured: true };
}

function activityMoment(activity: AgendaActivity) {
  return new Date(`${activity.date}T${activity.startTime}:00-04:00`);
}

function activityBody(activity: AgendaActivity) {
  const place = activity.place ? ` · ${activity.place}` : "";
  return `${activity.startTime} · ${activity.title}${place}`;
}

export async function notifyAgendaActivityCreated(activity: AgendaActivity) {
  const common = {
    activityId: activity.id,
    scheduledFor: activityMoment(activity),
  };
  return Promise.all([
    sendPushToAudience({
      ...common,
      audience: "mayor",
      type: "agenda_creada_alcalde",
      dedupePrefix: `agenda-created-mayor:${activity.id}`,
      payload: {
        title: "Nueva actividad por decidir",
        body: `${activityBody(activity)}. Confirma tu asistencia o designa un representante.`,
        tag: `agenda-created-${activity.id}`,
        url: "/?access=1",
      },
    }),
    sendPushToAudience({
      ...common,
      audience: "secretario_municipal",
      type: "agenda_creada_secretario",
      dedupePrefix: `agenda-created-secretary:${activity.id}`,
      payload: {
        title: "Nueva actividad institucional",
        body: activityBody(activity),
        tag: `agenda-created-${activity.id}`,
        url: "/?access=1",
      },
    }),
    sendPushToAudience({
      ...common,
      audience: "prensa",
      type: "agenda_creada_prensa",
      dedupePrefix: `agenda-created-press:${activity.id}`,
      payload: {
        title: "Nueva actividad en agenda",
        body: activityBody(activity),
        tag: `agenda-created-${activity.id}`,
        url: "/?access=1",
      },
    }),
  ]);
}

export async function notifyAgendaDelegate(activity: AgendaActivity) {
  if (activity.attendance !== "designado" || !activity.delegatePositionName) return null;
  return sendPushToAudience({
    audience: { delegatePositionName: activity.delegatePositionName },
    type: "agenda_designacion",
    dedupePrefix: `agenda-delegate:${activity.id}:${activity.decidedAt ?? "current"}`,
    activityId: activity.id,
    scheduledFor: activityMoment(activity),
    payload: {
      title: "Has sido designado representante",
      body: activityBody(activity),
      tag: `agenda-delegate-${activity.id}`,
      url: "/?access=1",
    },
  });
}

function boliviaDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function boliviaTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/La_Paz",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

export async function dispatchScheduledAgendaNotifications(activities: AgendaActivity[], now = new Date()) {
  const results: unknown[] = [];
  const today = boliviaDateKey(now);
  const { hour, minute } = boliviaTimeParts(now);

  if (hour === 7 && minute < 15) {
    results.push(await sendPushToAudience({
      audience: "agenda_principal",
      type: "agenda_resumen_diario",
      dedupePrefix: `agenda-daily:${today}`,
      scheduledFor: now,
      payload: {
        title: "Revisa la agenda del día",
        body: activities.filter((item) => item.date === today && item.status !== "cancelada").length
          ? "Consulta las actividades institucionales programadas para hoy."
          : "No hay actividades confirmadas para hoy; revisa la agenda por posibles novedades.",
        tag: `agenda-daily-${today}`,
        url: "/?access=1",
      },
    }));
  }

  for (const activity of activities) {
    if (activity.status === "cancelada") continue;
    const startsAt = activityMoment(activity);
    const minutesUntil = Math.round((startsAt.getTime() - now.getTime()) / 60_000);
    if (minutesUntil >= 50 && minutesUntil <= 65) {
      const attendeeAudience: Audience | null = activity.attendance === "alcalde"
        ? "mayor"
        : activity.attendance === "designado" && activity.delegatePositionName
          ? { delegatePositionName: activity.delegatePositionName }
          : null;
      if (attendeeAudience) {
        results.push(await sendPushToAudience({
          audience: attendeeAudience,
          type: "agenda_recordatorio_asistente",
          dedupePrefix: `agenda-attendee-60:${activity.id}`,
          activityId: activity.id,
          scheduledFor: startsAt,
          payload: {
            title: "Actividad en una hora",
            body: activityBody(activity),
            tag: `agenda-attendee-${activity.id}`,
            url: "/?access=1",
          },
        }));
      }
      results.push(await sendPushToAudience({
        audience: "secretario_municipal",
        type: "agenda_recordatorio_secretario",
        dedupePrefix: `agenda-secretary-60:${activity.id}`,
        activityId: activity.id,
        scheduledFor: startsAt,
        payload: {
          title: "Actividad institucional en una hora",
          body: activityBody(activity),
          tag: `agenda-secretary-${activity.id}`,
          url: "/?access=1",
        },
      }));
    }
    if (minutesUntil >= 20 && minutesUntil <= 35) {
      results.push(await sendPushToAudience({
        audience: "prensa",
        type: "agenda_recordatorio_prensa",
        dedupePrefix: `agenda-press-30:${activity.id}`,
        activityId: activity.id,
        scheduledFor: startsAt,
        payload: {
          title: "Actividad institucional en 30 minutos",
          body: activityBody(activity),
          tag: `agenda-press-${activity.id}`,
          url: "/?access=1",
        },
      }));
    }
  }
  return results;
}
