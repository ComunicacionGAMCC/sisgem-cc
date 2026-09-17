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
import { UiIcon } from "./ui-icons";

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
  attendance: AgendaAttendance;
  delegatePositionCode: string | null;
  delegatePositionName: string | null;
  delegateUnitName: string | null;
  decisionByName: string | null;
  decidedAt: string | null;
  createdByName: string | null;
};

type AgendaActivityStatus = "confirmada" | "tentativa" | "cancelada";
type AgendaAttendance = "pendiente" | "alcalde" | "designado";

type AgendaDelegatePosition = {
  code: string;
  name: string;
  unitName: string;
};

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
    || context.permissions.includes("sigem.agenda.decide")
    || context.permissions.includes("platform.users.manage")
    || context.permissions.includes("sigem.users.manage")
  ) return true;
  const hasSigemRole = context.roles.some((role) => role.module === "sigem");
  if (hasSigemRole && /(alcalde|secretar.*(?:gabinete|general)|chofer.*ejecutivo.*coordinador)/i.test(context.profile.jobTitle ?? "")) return true;

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
    && /secretar.*(?:gabinete|general)/i.test(context.profile.jobTitle ?? "");
}

export function canDecideCabinetAgendaAttendance(context: AgendaAccessContext | null | undefined) {
  if (!context) return false;
  if (
    context.permissions.includes("sigem.agenda.decide")
    || context.permissions.includes("platform.users.manage")
    || context.permissions.includes("sigem.users.manage")
  ) return true;
  return context.roles.some((role) => role.module === "sigem")
    && /(alcalde|chofer.*ejecutivo.*coordinador)/i.test(context.profile.jobTitle ?? "");
}

function useAgendaActivities(from: string, to = from) {
  const access = useAccess();
  const [items, setItems] = useState<AgendaActivity[]>([]);
  const [delegatePositions, setDelegatePositions] = useState<AgendaDelegatePosition[]>([]);
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
        const data = (await response.json()) as { items?: AgendaActivity[]; delegatePositions?: AgendaDelegatePosition[]; error?: string };
        if (!response.ok || !data.items) throw new Error(data.error || "No se pudo cargar la agenda.");
        setItems(data.items);
        setDelegatePositions(data.delegatePositions ?? []);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No se pudo cargar la agenda.");
        setItems([]);
        setDelegatePositions([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [access.context, access.session?.access_token, from, refresh, to]);

  return { items, delegatePositions, loading, error, reload: () => setRefresh((value) => value + 1) };
}

function ActivityTime({ item }: { item: AgendaActivity }) {
  return <time>{item.startTime}{item.endTime ? `–${item.endTime}` : ""}</time>;
}

function attendanceLabel(item: AgendaActivity) {
  if (item.attendance === "alcalde") return "Asistirá el alcalde";
  if (item.attendance === "designado") {
    return `Representará: ${item.delegatePositionName ?? "Autoridad designada"}`;
  }
  return "Asistencia pendiente";
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
  const [delegateActivity, setDelegateActivity] = useState<AgendaActivity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionActivityId, setActionActivityId] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const activeDate = selectedDate || (today ? getMunicipalIsoDate(today) : "");
  const canManage = canManageCabinetAgenda(access.context);
  const canDecideAttendance = canDecideCabinetAgendaAttendance(access.context);

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
  const { items, delegatePositions, loading, error, reload } = useAgendaActivities(activeDate);
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
          status: editingActivity?.status ?? "tentativa",
        }),
      });
      const data = (await response.json()) as { item?: AgendaActivity; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo guardar la actividad.");
      formElement.reset();
      setSelectedDate(data.item.date);
      closeForm();
      setMessage(editingActivity ? "Actividad actualizada correctamente." : "Actividad incorporada a la agenda institucional.");
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
      setMessage("Actividad cancelada; se conserva en el historial.");
      reloadAgenda();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo actualizar el estado.");
      setMessageIsError(true);
    } finally {
      setActionActivityId("");
    }
  }

  async function decideAttendance(
    item: AgendaActivity,
    attendance: Exclude<AgendaAttendance, "pendiente">,
    delegatePositionCode?: string,
  ) {
    const accessToken = access.session?.access_token;
    if (!accessToken || !canDecideAttendance) return;
    setActionActivityId(item.id);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(`/api/agenda/${item.id}/attendance`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ attendance, delegatePositionCode }),
      });
      const data = (await response.json()) as { item?: AgendaActivity; error?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.error || "No se pudo guardar la decisión de asistencia.");
      }
      setDelegateActivity(null);
      setMessage(attendance === "alcalde"
        ? "Asistencia del alcalde confirmada correctamente."
        : `Se designó a ${data.item.delegatePositionName ?? "la autoridad seleccionada"}.`);
      reloadAgenda();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo guardar la decisión de asistencia.");
      setMessageIsError(true);
    } finally {
      setActionActivityId("");
    }
  }

  function submitDelegate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!delegateActivity) return;
    const form = new FormData(event.currentTarget);
    const delegatePositionCode = String(form.get("delegatePositionCode") ?? "");
    if (!delegatePositionCode) return;
    void decideAttendance(delegateActivity, "designado", delegatePositionCode);
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
    return <section className="moduleView"><p className="agendaState error">No tienes acceso a la agenda institucional.</p></section>;
  }

  return (
    <section className="moduleView">
      <div className="moduleTitle">
        <div><span className="moduleEyebrow">PROGRAMACIÓN</span><h2>Calendario de actividades</h2><p>Secretaría General programa; el alcalde o su coordinador confirman quién asistirá.</p></div>
        {canManage ? <button className="primaryAction" onClick={openNewActivity}><UiIcon name="plus" size={17} />Nueva actividad</button> : null}
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
            <div className="agendaEventDetails"><strong>{item.title}</strong><span>{item.place || "Lugar por confirmar"}{item.description ? ` · ${item.description}` : ""}</span><span className={`agendaAttendance ${item.attendance}`}>{attendanceLabel(item)}{item.delegateUnitName ? ` · ${item.delegateUnitName}` : ""}</span>{item.decisionByName ? <small>Decisión registrada por {item.decisionByName}</small> : null}</div>
            <div className="agendaEventControl">
              <span className={`agendaStatus ${item.status}`}>{statusLabels[item.status]}</span>
              {(canManage || canDecideAttendance) && <div className="agendaEventActions" aria-label={`Acciones para ${item.title}`}>
                {canDecideAttendance && item.status !== "cancelada" && item.attendance !== "alcalde" ? <button type="button" className="confirm" onClick={() => void decideAttendance(item, "alcalde")} disabled={actionActivityId === item.id}>Confirmar alcalde</button> : null}
                {canDecideAttendance && item.status !== "cancelada" ? <button type="button" className="delegate" onClick={() => setDelegateActivity(item)} disabled={actionActivityId === item.id}>Designar representante</button> : null}
                {canManage ? <button type="button" onClick={() => openEditActivity(item)} disabled={actionActivityId === item.id}>Editar</button> : null}
                {canManage && item.status !== "cancelada" ? <button type="button" className="cancel" onClick={() => void changeActivityStatus(item, "cancelada")} disabled={actionActivityId === item.id}>Cancelar</button> : null}
                {canManage ? <button type="button" className="delete" onClick={() => void removeActivity(item)} disabled={actionActivityId === item.id}>Eliminar</button> : null}
              </div>}
            </div>
          </article>
        ))}
      </section>

      {showForm && canManage && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <form className="routeModal agendaModal" onSubmit={submitActivity} key={editingActivity?.id ?? "new"} role="dialog" aria-modal="true" aria-labelledby="agenda-modal-title">
            <header className="modalHeader"><div><span>AGENDA INSTITUCIONAL</span><h2 id="agenda-modal-title">{editingActivity ? "Editar actividad" : "Nueva actividad"}</h2></div><button type="button" onClick={closeForm} aria-label="Cerrar">×</button></header>
            <label>Título de la actividad<input name="title" defaultValue={editingActivity?.title ?? ""} required minLength={3} maxLength={220} /></label>
            <div className="formGrid">
              <label>Fecha<input name="date" type="date" defaultValue={editingActivity?.date ?? activeDate} required /></label>
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

      {delegateActivity && canDecideAttendance && (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDelegateActivity(null); }}>
          <form className="routeModal agendaModal agendaDelegateModal" onSubmit={submitDelegate} role="dialog" aria-modal="true" aria-labelledby="agenda-delegate-title">
            <header className="modalHeader"><div><span>DECISIÓN DE ASISTENCIA</span><h2 id="agenda-delegate-title">Designar representante</h2><p>{delegateActivity.title}</p></div><button type="button" onClick={() => setDelegateActivity(null)} aria-label="Cerrar">×</button></header>
            <label>Autoridad que asistirá<select name="delegatePositionCode" defaultValue={delegateActivity.delegatePositionCode ?? ""} required><option value="" disabled>Selecciona una autoridad</option>{delegatePositions.map((position) => <option value={position.code} key={position.code}>{position.name} · {position.unitName}</option>)}</select></label>
            <p className="agendaDecisionHelp">Puedes designar al Secretario Municipal o a cualquiera de los seis directores de área. La decisión quedará registrada en el historial.</p>
            {message && <p className={`agendaFeedback${messageIsError ? " error" : ""}`} role={messageIsError ? "alert" : "status"}>{message}</p>}
            <footer className="modalActions"><button type="button" onClick={() => setDelegateActivity(null)}>Cerrar</button><button className="primaryAction" disabled={actionActivityId === delegateActivity.id}>{actionActivityId === delegateActivity.id ? "Guardando…" : "Confirmar designación"}</button></footer>
          </form>
        </div>
      )}
    </section>
  );
}
