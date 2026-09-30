import type { NextRequest } from "next/server";
import { listAgendaActivities } from "../../../../db/agenda";
import { dispatchScheduledAgendaNotifications } from "../../../../lib/agenda-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function dateKeyInBolivia(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const now = new Date();
    const today = dateKeyInBolivia(now);
    const tomorrow = dateKeyInBolivia(new Date(now.getTime() + 24 * 60 * 60 * 1_000));
    const activities = await listAgendaActivities(today, tomorrow);
    const deliveries = await dispatchScheduledAgendaNotifications(activities, now);
    return Response.json({ ok: true, checkedAt: now.toISOString(), activities: activities.length, deliveries });
  } catch (error) {
    console.error("No se pudieron procesar las notificaciones programadas", error);
    return Response.json({ error: "No se pudieron procesar las notificaciones." }, { status: 500 });
  }
}
