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
  status: AgendaActivityStatus;
  createdByName: string | null;
};

type AgendaActivityStatus = "confirmada" | "tentativa" | "cancelada";

const statusLabels: Record<AgendaActivityStatus, string> = {
  confirmada: "Confirmada",
  tentativa: "Por confirmar",
  cancelada: "Cancelada",
};

export function canAccessCabinetAgenda(context: AgendaAccessContext | null | undefined) {
  if (!context) return false;
  if (
    context.permissions.includes("sigem.agenda.read")
    || context.permissions.includes("sigem.agenda.manage")
    || context.permissions.includes("platform.users.manage")
    || context.permissions.includes("sigem.users.manage")
  ) return true;
  const hasSigemRole = context.roles.some((role) => role.module === "sigem");
  if (hasSigemRole && /(secretar.*gabinete|chofer.*ejecutivo.*coordinador)/i.test(context.profile.jobTitle ?? "")) return true;

  return context.roles.some((role) => (
    role.module === "sigem"
    && role.scopeType === "municipal_unit"
    && /gabinete/i.test(role.scopeLabel ?? "")
  ));
}

export function canManageCabinetAgenda(context: AgendaAccessContext | null | undefined) {
  if (!context) return false;
  if (
    context.permissions.includes("sigem.agenda.manage")
    || context.permissions.includes("platform.users.manage")
    || context.permissions.includes("sigem.users.manage")
  ) return true;
  return context.roles.some((role) => role.module === "sigem")
    && /(secretar.*gabinete|chofer.*ejecutivo.*coordinador)/i.test(context.profile.jobTitle ?? "");
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
  const activeItems = items.filter((item) => item.status !== "cancelada");
  return (
    <>
      <div className="agendaList">
        {loading && <p className="agendaCompactState">Cargando actividades…</p>}
        {!loading && error && <p className="agendaCompactState error">{error}</p>}
        {!loading && !error && !activeItems.length && <p className="agendaCompactState">No hay actividades agendadas para hoy.</p>}
        {!loading && !error && activeItems.slice(0, 4).map((item) => (
          <article className="agendaItem" key={item.id}>
            <ActivityTime item={item} />
            <i className={`agendaMark ${item.status === "tentativa" ? "orange" : "green"}`} />
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
  const [editingActivity, setEditingActivity] = useState<AgendaActivity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionActivityId, setActionActivityId] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const activeDate = selectedDate || (today ? getMunicipalIsoDate(today) : "");
  const canManage = canManageCabinetAgenda(access.context);

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
  const weekFrom = week[0] ? getMunicipalIsoDate(week[0]) : "";
  const weekTo = week[week.length - 1] ? getMunicipalIsoDate(week[week.length - 1]) : "";
  const { items, loading, error, reload } = useAgendaActivities(activeDate);
  const { items: weekItems, reload: reloadWeek } = useAgendaActivities(weekFrom, weekTo);
  const datesWithAgenda = useMemo(
    () => new Set(weekItems.filter((item) => item.status !== "cancelada").map((item) => item.date)),
    [weekItems],
  );
  const selectedLabel = selected
    ? capitalizeDateLabel(formatMunicipalDate(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))
    : "Selecciona una fecha";

  function moveWeek(days: number) {
    if (!selected) return;
    setSelectedDate(getMunicipalIsoDate(addMunicipalDays(selected, days)));
  }

  function closeForm() {
    setShowForm(false);
    setEditingActivity(null);
  }

  function openNewActivity() {
    setEditingActivity(null);
    setMessage("");
    setMessageIsError(false);
    setShowForm(true);
  }

  function openEditActivity(item: AgendaActivity) {
    setEditingActivity(item);
    setMessage("");
    setMessageIsError(false);
    setShowForm(true);
  }

  function activityPayload(item: AgendaActivity, status = item.status) {
    return {
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      title: item.title,
      place: item.place,
      description: item.description,
      status,
    };
  }

  function reloadAgenda() {
    reload();
    reloadWeek();
  }

  async function submitActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accessToken = access.session?.access_token;
    if (!accessToken) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(editingActivity ? `/api/agenda/${editingActivity.id}` : "/api/agenda", {
        method: editingActivity ? "PATCH" : "POST",
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
      closeForm();
      setMessage(editingActivity ? "Actividad actualizada correctamente." : "Actividad registrada correctamente en la agenda del alcalde.");
      reloadAgenda();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo guardar la actividad.");
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function changeActivityStatus(item: AgendaActivity, status: AgendaActivityStatus) {
    const accessToken = access.session?.access_token;
    if (!accessToken || !canManage || item.status === status) return;
    setActionActivityId(item.id);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(`/api/agenda/${item.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(activityPayload(item, status)),
      });
      const data = (await response.json()) as { item?: AgendaActivity; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo actualizar el estado.");
      setMessage(status === "confirmada" ? "Actividad confirmada correctamente." : "Actividad cancelada; se conserva en el historial.");
      reloadAgenda();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo actualizar el estado.");
      setMessageIsError(true);
    } finally {
      setActionActivityId("");
    }
  }

  async function removeActivity(item: AgendaActivity) {
    const accessToken = access.session?.access_token;
    if (!accessToken || !canManage) return;
    if (!window.confirm(`¿Eliminar definitivamente “${item.title}”?`)) return;
    setActionActivityId(item.id);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(`/api/agenda/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await response.json()) as { deleted?: boolean; error?: string };
      if (!response.ok || !data.deleted) throw new Error(data.error || "No se pudo eliminar la actividad.");
      setMessage("Actividad eliminada definitivamente de la agenda.");
      reloadAgenda();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo eliminar la actividad.");
      setMessageIsError(true);
    } finally {
      setActionActivityId("");
    }
  }

  if (!canAccessCabinetAgenda(access.context)) {
    return <section className="moduleView"><p className="agendaState error">No tienes acceso a la agenda del alcalde.</p></section>;
  }

  return (
    <section className="moduleView">
      <div className="moduleTitle">
        <div><h2>Agenda del alcalde</h2><p>Consulta actividades pasadas y futuras o registra una nueva.</p></div>
        {canManage && <button className="primaryAction" onClick={openNewActivity}><span>＋</span>Agendar actividad</button>}
      </div>
      <div className="agendaDateToolbar">
        <label>Ir a una fecha<input type="date" value={activeDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <button onClick={() => today && setSelectedDate(getMunicipalIsoDate(today))}>Volver a hoy</button>
      </div>
      <div className="calendarStrip">
        <button aria-label="Semana anterior" onClick={() => moveWeek(-7)}>‹</button>
        {week.map((date) => {
          const dateKey = getMunicipalIsoDate(date);
          const isActive = dateKey === activeDate;
          const hasAgenda = datesWithAgenda.has(dateKey);
          const className = `calendarDay${isActive ? " active" : hasAgenda ? " hasAgenda" : ""}`;
          return <button className={className} onClick={() => setSelectedDate(dateKey)} key={dateKey} aria-current={isActive ? "date" : undefined} aria-label={`${capitalizeDateLabel(formatMunicipalDate(date, { weekday: "long", day: "numeric", month: "long" }))}${hasAgenda ? ", con actividades" : ""}`}><small>{formatMunicipalDate(date, { weekday: "short" }).replace(".", "").toUpperCase()}</small><b>{date.getUTCDate()}</b>{hasAgenda && !isActive ? <i aria-hidden="true" /> : null}</button>;
        })}
        <button aria-label="Semana siguiente" onClick={() => moveWeek(7)}>›</button>
      </div>
      {message && <p className={`agendaFeedback${messageIsError ? " error" : ""}`} role={messageIsError ? "alert" : "status"}>{message}</p>}
      <section className="panel dayAgenda">
        <h3>{selectedLabel}</h3>
        {loading && <p className="agendaState">Cargando actividades…</p>}
        {!loading && error && <p className="agendaState error">{error}</p>}
        {!loading && !error && !items.length && <p className="agendaState">No hay actividades agendadas para esta fecha.</p>}
        {!loading && !error && items.map((item) => (
          <article className={`dayEvent ${item.status}`} key={item.id}>
            <ActivityTime item={item} />
            <i className={item.status === "tentativa" ? "orange" : item.status === "cancelada" ? "neutral" : "green"} />
            <div><strong>{item.title}</strong><span>{item.place || "Lugar por confirmar"}{item.description ? ` · ${item.description}` : ""}</span></div>
            <div className="agendaEventControl">
              <span className={`agendaStatus ${item.status}`}>{statusLabels[item.status]}</span>
              {canManage && <div className="agendaEventActions" aria-label={`Acciones para ${item.title}`}>
                <button type="button" onClick={() => openEditActivity(item)} disabled={actionActivityId === item.id}>Editar</button>
                {item.status !== "confirmada" && <button type="button" className="confirm" onClick={() => void changeActivityStatus(item, "confirmada")} disabled={actionActivityId === item.id}>Confirmar</button>}
                {item.status !== "cancelada" && <button type="button" className="cancel" onClick={() => void changeActivityStatus(item, "cancelada")} disabled={actionActivityId === item.id}>Cancelar</button>}
                <button type="button" className="delete" onClick={() => void removeActivity(item)} disabled={actionActivityId === item.id}>Eliminar</button>
              </div>}
            </div>
          </article>
        ))}
      </section>

      {showForm && canManage && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <form className="routeModal agendaModal" onSubmit={submitActivity} key={editingActivity?.id ?? "new"} role="dialog" aria-modal="true" aria-labelledby="agenda-modal-title">
            <header className="modalHeader"><div><span>AGENDA DEL ALCALDE</span><h2 id="agenda-modal-title">{editingActivity ? "Editar actividad" : "Nueva actividad"}</h2></div><button type="button" onClick={closeForm} aria-label="Cerrar">×</button></header>
            <label>Título de la actividad<input name="title" defaultValue={editingActivity?.title ?? ""} required minLength={3} maxLength={220} /></label>
            <div className="formGrid">
              <label>Fecha<input name="date" type="date" defaultValue={editingActivity?.date ?? activeDate} required /></label>
              <label>Estado<select name="status" defaultValue={editingActivity?.status ?? "confirmada"}><option value="confirmada">Confirmada</option><option value="tentativa">Por confirmar</option><option value="cancelada">Cancelada</option></select></label>
              <label>Hora de inicio<input name="startTime" type="time" defaultValue={editingActivity?.startTime ?? ""} required /></label>
              <label>Hora de finalización<input name="endTime" type="time" defaultValue={editingActivity?.endTime ?? ""} /></label>
            </div>
            <label>Lugar<input name="place" defaultValue={editingActivity?.place ?? ""} maxLength={220} placeholder="Ej.: Despacho del Alcalde" /></label>
            <label>Descripción<textarea name="description" defaultValue={editingActivity?.description ?? ""} maxLength={2000} rows={4} /></label>
            {message && <p className={`agendaFeedback${messageIsError ? " error" : ""}`} role={messageIsError ? "alert" : "status"}>{message}</p>}
            <footer className="modalActions"><button type="button" onClick={closeForm}>Cerrar</button><button className="primaryAction" disabled={submitting}>{submitting ? "Guardando…" : editingActivity ? "Guardar cambios" : "Guardar actividad"}</button></footer>
          </form>
        </div>
      )}
    </section>
  );
}
