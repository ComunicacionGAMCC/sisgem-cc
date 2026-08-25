"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addMunicipalDays,
  capitalizeDateLabel,
  formatMunicipalDate,
  getMunicipalIsoDate,
  parseMunicipalIsoDate,
} from "../lib/municipal-date";
import { useAccess } from "./access";

type AgendaAccessContext = {
  profile: {
    jobTitle: string | null;
  };
  permissions: string[];
  roles: Array<{
    module: "platform" | "sigem" | "health";
    scopeType: "global" | "municipal_unit" | "facility";
    scopeLabel: string | null;
  }>;
};

export type AgendaActivity = {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  title: string;
  place: string | null;
  description: string | null;
  status: string;
  createdByName: string | null;
};

export function canAccessCabinetAgenda(context: AgendaAccessContext | null | undefined) {
  if (!context) return false;
  if (
    context.permissions.includes("platform.users.manage")
    || context.permissions.includes("sigem.users.manage")
  ) return true;
  const hasSigemRole = context.roles.some((role) => role.module === "sigem");
  if (hasSigemRole && /gabinete/i.test(context.profile.jobTitle ?? "")) return true;

  return context.roles.some((role) => (
    role.module === "sigem"
    && role.scopeType === "municipal_unit"
    && /gabinete/i.test(role.scopeLabel ?? "")
  ));
}

function useAgendaActivities(from: string, to = from) {
  const access = useAccess();
  const [items, setItems] = useState<AgendaActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const accessToken = access.session?.access_token;
    if (!accessToken || !from || !to || !canAccessCabinetAgenda(access.context)) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/agenda?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = (await response.json()) as { items?: AgendaActivity[]; error?: string };
        if (!response.ok || !data.items) throw new Error(data.error || "No se pudo cargar la agenda.");
        setItems(data.items);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No se pudo cargar la agenda.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [access.context, access.session?.access_token, from, refresh, to]);

  return { items, loading, error, reload: () => setRefresh((value) => value + 1) };
}

function ActivityTime({ item }: { item: AgendaActivity }) {
  return <time>{item.startTime}{item.endTime ? `–${item.endTime}` : ""}</time>;
}

export function AgendaSummary({ today, onOpen }: { today: Date | null; onOpen: () => void }) {
  const date = today ? getMunicipalIsoDate(today) : "";
  const { items, loading, error } = useAgendaActivities(date);
  return (
    <>
      <div className="agendaList">
        {loading && <p className="agendaCompactState">Cargando actividades…</p>}
        {!loading && error && <p className="agendaCompactState error">{error}</p>}
        {!loading && !error && !items.length && <p className="agendaCompactState">No hay actividades agendadas para hoy.</p>}
        {!loading && !error && items.slice(0, 4).map((item, index) => (
          <article className="agendaItem" key={item.id}>
            <ActivityTime item={item} />
            <i className={`agendaMark ${item.status === "tentativa" ? "orange" : index % 2 ? "blue" : "green"}`} />
            <div><strong>{item.title}</strong><span>{item.place || "Lugar por confirmar"}</span></div>
          </article>
        ))}
      </div>
      <button className="subtleAction" onClick={onOpen}>＋ Ver agenda completa</button>
    </>
  );
}

export function AgendaModule({ today }: { today: Date | null }) {
  const access = useAccess();
  const [selectedDate, setSelectedDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const activeDate = selectedDate || (today ? getMunicipalIsoDate(today) : "");
  const { items, loading, error, reload } = useAgendaActivities(activeDate);

  const selected = useMemo(
    () => activeDate ? parseMunicipalIsoDate(activeDate) : null,
    [activeDate],
  );
  const week = useMemo(() => {
    if (!selected) return [];
    const day = selected.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return Array.from({ length: 7 }, (_, index) => addMunicipalDays(selected, mondayOffset + index));
  }, [selected]);
  const selectedLabel = selected
    ? capitalizeDateLabel(formatMunicipalDate(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))
    : "Selecciona una fecha";

  function moveWeek(days: number) {
    if (!selected) return;
    setSelectedDate(getMunicipalIsoDate(addMunicipalDays(selected, days)));
  }

  async function submitActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accessToken = access.session?.access_token;
    if (!accessToken) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/agenda", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: form.get("date"),
          startTime: form.get("startTime"),
          endTime: form.get("endTime"),
          title: form.get("title"),
          place: form.get("place"),
          description: form.get("description"),
          status: form.get("status"),
        }),
      });
      const data = (await response.json()) as { item?: AgendaActivity; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo guardar la actividad.");
      formElement.reset();
      setSelectedDate(data.item.date);
      setShowForm(false);
      setMessage("Actividad registrada correctamente en la agenda del alcalde.");
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo guardar la actividad.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canAccessCabinetAgenda(access.context)) {
    return <section className="moduleView"><p className="agendaState error">No tienes acceso a la agenda del alcalde.</p></section>;
  }

  return (
    <section className="moduleView">
      <div className="moduleTitle">
        <div><h2>Agenda del alcalde</h2><p>Consulta actividades pasadas y futuras o registra una nueva.</p></div>
        <button className="primaryAction" onClick={() => setShowForm(true)}><span>＋</span>Agendar actividad</button>
      </div>
      <div className="agendaDateToolbar">
        <label>Ir a una fecha<input type="date" value={activeDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <button onClick={() => today && setSelectedDate(getMunicipalIsoDate(today))}>Volver a hoy</button>
      </div>
      <div className="calendarStrip">
        <button aria-label="Semana anterior" onClick={() => moveWeek(-7)}>‹</button>
        {week.map((date) => {
          const dateKey = getMunicipalIsoDate(date);
          return <button className={`calendarDay ${dateKey === activeDate ? "active" : ""}`} onClick={() => setSelectedDate(dateKey)} key={dateKey}><small>{formatMunicipalDate(date, { weekday: "short" }).replace(".", "").toUpperCase()}</small><b>{date.getUTCDate()}</b></button>;
        })}
        <button aria-label="Semana siguiente" onClick={() => moveWeek(7)}>›</button>
      </div>
      {message && <p className="agendaFeedback" role="status">{message}</p>}
      <section className="panel dayAgenda">
        <h3>{selectedLabel}</h3>
        {loading && <p className="agendaState">Cargando actividades…</p>}
        {!loading && error && <p className="agendaState error">{error}</p>}
        {!loading && !error && !items.length && <p className="agendaState">No hay actividades agendadas para esta fecha.</p>}
        {!loading && !error && items.map((item) => (
          <article className="dayEvent" key={item.id}>
            <ActivityTime item={item} />
            <i className={item.status === "tentativa" ? "orange" : "green"} />
            <div><strong>{item.title}</strong><span>{item.place || "Lugar por confirmar"}{item.description ? ` · ${item.description}` : ""}</span></div>
            <span>{item.status === "tentativa" ? "Tentativa" : "Confirmada"}</span>
          </article>
        ))}
      </section>

      {showForm && (
        <div className="modalBackdrop" role="presentation">
          <form className="routeModal agendaModal" onSubmit={submitActivity}>
            <header className="modalHeader"><div><span>AGENDA DEL ALCALDE</span><h2>Nueva actividad</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar">×</button></header>
            <label>Título de la actividad<input name="title" required minLength={3} maxLength={220} /></label>
            <div className="formGrid">
              <label>Fecha<input name="date" type="date" defaultValue={activeDate} required /></label>
              <label>Estado<select name="status" defaultValue="confirmada"><option value="confirmada">Confirmada</option><option value="tentativa">Tentativa</option></select></label>
              <label>Hora de inicio<input name="startTime" type="time" required /></label>
              <label>Hora de finalización<input name="endTime" type="time" /></label>
            </div>
            <label>Lugar<input name="place" maxLength={220} placeholder="Ej.: Despacho del Alcalde" /></label>
            <label>Descripción<textarea name="description" maxLength={2000} rows={4} /></label>
            {message && <p className="agendaFeedback" role="status">{message}</p>}
            <footer className="modalActions"><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primaryAction" disabled={submitting}>{submitting ? "Guardando…" : "Guardar actividad"}</button></footer>
          </form>
        </div>
      )}
    </section>
  );
}
