"use client";

import { FormEvent, useState } from "react";
import { useAccess } from "./access";

export type RouteItem = {
  id?: string;
  code: string;
  title: string;
  description?: string | null;
  sender: string;
  unit: string;
  unitCode?: string;
  status: string;
  state?: string;
  priority?: string;
  due: string;
  tone: string;
  createdAt?: string;
  dueAt?: string | null;
};

export type MunicipalUnit = { id: string; code: string; name: string };

type RouteDetail = RouteItem & {
  id: string;
  senderDocument?: string | null;
  senderPhone?: string | null;
  senderEmail?: string | null;
  currentUnitId: string;
  units: Array<{ id: string; code: string; name: string }>;
  events: Array<{ id: string; title: string; description?: string | null; unit?: string | null; public: boolean; actorName?: string | null; createdAt: string }>;
  derivations: Array<{ id: string; originUnit?: string | null; destinationUnit: string; state: string; note?: string | null; derivedAt: string; receivedAt?: string | null }>;
  attachments: Array<{ id: string; name: string; mimeType: string; size: number; public: boolean; uploadedBy?: string | null; createdAt: string }>;
};

type Filter = "todos" | "pendientes" | "finalizados";

function prettyDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(value));
}

export function RouteWorkflowPanel({
  openRouteModal, filter, setFilter, search, setSearch, visibleRoutes, allRoutes, loading, refresh,
}: {
  openRouteModal: () => void;
  filter: Filter;
  setFilter: (value: Filter) => void;
  search: string;
  setSearch: (value: string) => void;
  visibleRoutes: readonly RouteItem[];
  allRoutes: readonly RouteItem[];
  loading: boolean;
  refresh: () => void;
}) {
  const access = useAccess();
  const [selected, setSelected] = useState<RouteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState("act");
  const [submitting, setSubmitting] = useState(false);
  const finalizados = allRoutes.filter((route) => route.state === "finalizado" || route.state === "archivado").length;
  const pendientes = allRoutes.length - finalizados;
  const token = access.session?.access_token ?? "";

  async function openDetail(id?: string) {
    if (!id) return;
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/hojas-ruta/${id}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      const data = (await response.json()) as { item?: RouteDetail; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo abrir el expediente.");
      setSelected(data.item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el expediente.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/hojas-ruta/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: action,
          detail: form.get("description"),
          note: form.get("description"),
          title: action === "act" ? "Actuación registrada" : undefined,
          destinationUnitId: form.get("destinationUnitId") || undefined,
          dueAt: form.get("dueAt") || undefined,
          public: form.get("public") === "on",
        }),
      });
      const data = (await response.json()) as { item?: RouteDetail; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo registrar la actuación.");
      setSelected(data.item);
      refresh();
      event.currentTarget.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la actuación.");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/hojas-ruta/${selected.id}/adjuntos`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = (await response.json()) as { item?: RouteDetail; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo adjuntar el documento.");
      setSelected(data.item);
      event.currentTarget.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo adjuntar el documento.");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadAttachment(attachment: RouteDetail["attachments"][number]) {
    if (!selected) return;
    setError("");
    try {
      const response = await fetch(`/api/hojas-ruta/${selected.id}/adjuntos/${attachment.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("No se pudo descargar el documento.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo descargar el documento.");
    }
  }

  const allowedActions = [
    access.hasPermission("sigem.routes.receive") && { value: "receive", label: "Confirmar recepción" },
    access.hasPermission("sigem.routes.route") && { value: "derive", label: "Derivar a otra unidad" },
    access.hasPermission("sigem.routes.update") && { value: "act", label: "Registrar actuación" },
    access.hasPermission("sigem.routes.update") && { value: "observe", label: "Registrar observación" },
    access.hasPermission("sigem.routes.update") && { value: "deadline", label: "Definir o cambiar plazo" },
    access.hasPermission("sigem.routes.close") && { value: "close", label: "Finalizar trámite" },
    access.hasPermission("sigem.routes.close") && { value: "archive", label: "Archivar expediente" },
    access.hasPermission("sigem.routes.close") && { value: "reopen", label: "Reabrir expediente" },
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  return <section className="moduleView routeWorkflow">
    <div className="moduleTitle"><div><h2>Bandeja de hojas de ruta</h2><p>Recepción, derivación, plazos, documentos y cierre con trazabilidad completa</p></div>{access.hasPermission("sigem.routes.create") && <button className="primaryAction" onClick={openRouteModal}><span>＋</span>Nueva hoja de ruta</button>}</div>
    <div className="filterBar"><input aria-label="Buscar por código, asunto o remitente" placeholder="Buscar por código, asunto o remitente" value={search} onChange={(event) => setSearch(event.target.value)} /><button className={filter === "todos" ? "selected" : ""} onClick={() => setFilter("todos")}>Todos {allRoutes.length}</button><button className={filter === "pendientes" ? "selected" : ""} onClick={() => setFilter("pendientes")}>Pendientes {pendientes}</button><button className={filter === "finalizados" ? "selected" : ""} onClick={() => setFilter("finalizados")}>Finalizados {finalizados}</button></div>
    {error && !selected && <p className="formError" role="alert">{error}</p>}
    <section className="panel">{loading ? <p className="loadingState">Actualizando hojas de ruta…</p> : <div className="inboxList full">{visibleRoutes.length ? visibleRoutes.map((route) => <article className="inboxRow" key={route.code}><span className="docGlyph">▤</span><div className="inboxIdentity"><strong>{route.title}</strong><span>{route.sender} · <b>{route.code}</b></span></div><span className="unitPill">{route.unit}</span><div className="inboxStatus"><span className={route.tone}>{route.status}</span><small>{route.due}</small></div><button onClick={() => openDetail(route.id)} aria-label={`Abrir ${route.code}`}>›</button></article>) : <p className="emptyState">No se encontraron hojas de ruta.</p>}</div>}</section>
    {detailLoading && <div className="modalBackdrop"><section className="routeModal"><p className="loadingState">Abriendo expediente…</p></section></div>}
    {selected && <div className="modalBackdrop routeDetailBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="routeDetail" role="dialog" aria-modal="true" aria-labelledby="route-detail-title">
      <header className="routeDetailHeader"><div><span>{selected.code}</span><h2 id="route-detail-title">{selected.title}</h2><p>{selected.sender} · {selected.unit}</p></div><button onClick={() => setSelected(null)} aria-label="Cerrar expediente">×</button></header>
      <div className="routeSummary"><span className={selected.tone}>{selected.status}</span><div><small>Plazo</small><strong>{selected.due}</strong></div><div><small>Prioridad</small><strong>{selected.priority || "Normal"}</strong></div><div><small>Registrado</small><strong>{prettyDate(selected.createdAt)}</strong></div></div>
      {selected.description && <p className="routeDescription">{selected.description}</p>}
      {error && <p className="formError" role="alert">{error}</p>}
      <div className="routeDetailGrid">
        <div>
          <section className="routeSection"><h3>Historial del trámite</h3><div className="routeTimeline">{selected.events.map((item) => <article key={item.id}><i /><div><strong>{item.title}</strong><span>{prettyDate(item.createdAt)}{item.actorName ? ` · ${item.actorName}` : ""}</span>{item.description && <p>{item.description}</p>}<small>{item.unit || "Sistema"} · {item.public ? "Visible al ciudadano" : "Uso interno"}</small></div></article>)}</div></section>
          <section className="routeSection"><h3>Documentos adjuntos</h3>{selected.attachments.length ? <div className="attachmentList">{selected.attachments.map((file) => <button key={file.id} onClick={() => downloadAttachment(file)}><span>▧</span><div><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB · {file.public ? "Público" : "Interno"}</small></div><b>Descargar</b></button>)}</div> : <p className="emptyState">Aún no hay documentos adjuntos.</p>}{access.hasPermission("sigem.routes.update") && <form className="attachmentForm" onSubmit={uploadAttachment}><input type="file" name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" /><label><input type="checkbox" name="public" /> Visible en seguimiento ciudadano</label><button className="primaryAction" disabled={submitting}>Adjuntar</button></form>}</section>
        </div>
        <aside className="routeActions"><h3>Registrar movimiento</h3>{allowedActions.length ? <form onSubmit={submitAction}><label>Acción<select value={action} onChange={(event) => setAction(event.target.value)}>{allowedActions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>{action === "derive" && <label>Unidad de destino<select name="destinationUnitId" required defaultValue=""><option value="" disabled>Selecciona una unidad</option>{selected.units.filter((unit) => unit.id !== selected.currentUnitId).map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label>}{action === "deadline" && <label>Nuevo plazo<input name="dueAt" type="datetime-local" required /></label>}<label>Detalle<textarea name="description" rows={4} required placeholder="Describe la actuación, instrucción o resultado" /></label><label className="inlineCheck"><input type="checkbox" name="public" /> Mostrar este movimiento al ciudadano</label><button className="primaryAction" disabled={submitting}>{submitting ? "Guardando…" : "Guardar movimiento"}</button></form> : <p className="emptyState">Tu rol permite consultar, pero no modificar este expediente.</p>}<div className="routeContact"><h4>Datos del remitente</h4><span>{selected.sender}</span>{selected.senderDocument && <span>Documento: {selected.senderDocument}</span>}{selected.senderPhone && <span>Teléfono: {selected.senderPhone}</span>}{selected.senderEmail && <span>{selected.senderEmail}</span>}</div></aside>
      </div>
    </section></div>}
  </section>;
}

export function RouteCreateModal({ mode, close, succeed, createdCode, units }: { mode: "form" | "success"; close: () => void; succeed: (code: string) => void; createdCode: string; units: MunicipalUnit[] }) {
  const access = useAccess();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const token = access.session?.access_token ?? "";
    try {
      const response = await fetch("/api/hojas-ruta", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          remitente: form.get("remitente"), documento: form.get("documento"), telefono: form.get("telefono"), email: form.get("email"),
          asunto: form.get("asunto"), descripcion: form.get("descripcion"), tipo: form.get("tipo"), prioridad: form.get("prioridad"), unidadCodigo: form.get("unidadCodigo"),
        }),
      });
      const data = (await response.json()) as { item?: { id: string; code: string }; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo registrar la hoja de ruta.");
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        const upload = new FormData();
        upload.set("file", file);
        if (form.get("filePublic") === "on") upload.set("public", "true");
        const uploadResponse = await fetch(`/api/hojas-ruta/${data.item.id}/adjuntos`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: upload });
        const uploadData = (await uploadResponse.json()) as { error?: string };
        if (!uploadResponse.ok) throw new Error(`La hoja fue creada, pero el adjunto falló: ${uploadData.error || "revisa el archivo"}.`);
      }
      succeed(data.item.code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la hoja de ruta.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    {mode === "success" ? <section className="routeModal successModal" role="dialog" aria-modal="true" aria-labelledby="success-title"><div className="successMark">✓</div><h2 id="success-title">Hoja de ruta registrada</h2><p>El expediente fue creado con el código <strong>{createdCode}</strong>. Ya puede consultarse y gestionarse desde la bandeja.</p><button className="primaryAction" onClick={close}>Volver al panel</button></section>
      : <form className="routeModal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="route-title"><header className="modalHeader"><div><span>NUEVO EXPEDIENTE</span><h2 id="route-title">Crear hoja de ruta</h2></div><button type="button" onClick={close} aria-label="Cerrar">×</button></header><label>Remitente<input name="remitente" required maxLength={220} placeholder="Nombre de la persona o institución" /></label><div className="formGrid"><label>Documento<input name="documento" maxLength={80} placeholder="CI, NIT o referencia" /></label><label>Teléfono<input name="telefono" maxLength={40} placeholder="Número de contacto" /></label></div><label>Correo electrónico<input name="email" type="email" maxLength={180} placeholder="Opcional" /></label><label>Asunto<input name="asunto" required maxLength={300} placeholder="Resumen de la solicitud" /></label><label>Descripción<textarea name="descripcion" rows={3} placeholder="Describe brevemente la solicitud" /></label><div className="formGrid"><label>Tipo<select name="tipo" defaultValue="solicitud_externa"><option value="solicitud_externa">Solicitud externa</option><option value="comunicacion_interna">Comunicación interna</option><option value="solicitud_audiencia">Solicitud de audiencia</option></select></label><label>Prioridad<select name="prioridad" defaultValue="normal"><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label></div><label>Unidad de destino<select name="unidadCodigo" required defaultValue=""><option value="" disabled>Selecciona una unidad</option>{units.map((unit) => <option value={unit.code} key={unit.id}>{unit.name}</option>)}</select></label><label>Documento inicial (opcional)<input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" /></label><label className="inlineCheck"><input type="checkbox" name="filePublic" /> Visible para el ciudadano durante el seguimiento</label>{error && <p className="formError" role="alert">{error}</p>}<div className="modalActions"><button type="button" onClick={close}>Cancelar</button><button className="primaryAction" type="submit" disabled={submitting || units.length === 0}>{submitting ? "Registrando…" : "Registrar expediente →"}</button></div></form>}
  </div>;
}
