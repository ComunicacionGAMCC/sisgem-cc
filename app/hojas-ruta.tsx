"use client";

import QRCode from "qrcode";
import { FormEvent, useEffect, useState } from "react";
import { useAccess } from "./access";

export type RouteItem = {
  id?: string;
  code: string;
  title: string;
  consignee?: string | null;
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

export type RouteFilter = "recibir" | "derivar" | "historial";

type RouteDetail = RouteItem & {
  id: string;
  currentUnit?: string;
  senderPhone?: string | null;
  senderEmail?: string | null;
  currentUnitId: string;
  units: Array<{ id: string; code: string; name: string }>;
  events: Array<{ id: string; title: string; description?: string | null; unit?: string | null; public: boolean; actorName?: string | null; createdAt: string }>;
  derivations: Array<{ id: string; originUnit?: string | null; destinationUnit: string; state: string; note?: string | null; derivedAt: string; receivedAt?: string | null }>;
  attachments: Array<{ id: string; name: string; mimeType: string; size: number; public: boolean; uploadedBy?: string | null; createdAt: string }>;
};

const activeForDerivation = new Set(["recibido", "en_proceso", "observado"]);

function prettyDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(value));
}

function printDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/La_Paz" }).format(new Date(value));
}

function printTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/La_Paz" }).format(new Date(value));
}

function derivationStateLabel(state: string) {
  if (state === "pendiente") return "Pendiente de recepción";
  if (state === "recibida") return "Recibida";
  if (state === "atendida") return "Atendida y derivada";
  return state.replaceAll("_", " ");
}

function preferredAction(state: string | undefined, hasPermission: (permission: string) => boolean) {
  if (state === "derivado" && hasPermission("sigem.routes.receive")) return "receive";
  if (activeForDerivation.has(state ?? "") && hasPermission("sigem.routes.route")) return "derive";
  if (activeForDerivation.has(state ?? "") && hasPermission("sigem.routes.update")) return "act";
  if (state === "finalizado" && hasPermission("sigem.routes.close")) return "archive";
  if (state === "archivado" && hasPermission("sigem.routes.close")) return "reopen";
  return "act";
}

function RoutePrintSheet({ route, qrDataUrl }: { route: RouteDetail; qrDataUrl: string }) {
  const initialReception = [...route.events]
    .reverse()
    .find((event) => /solicitud (?:recibida|registrada)|recepci[oó]n/i.test(event.title));
  const receivedBy = initialReception?.actorName || initialReception?.unit || "Secretaría General";
  const contact = [route.senderPhone, route.senderEmail].filter(Boolean).join(" · ") || "Sin dato registrado";

  return <article className="routePrintSheet" aria-hidden="true">
    <header className="routePrintHeader">
      <div className="routePrintBrand"><img src="/marca-cuatro-canadas.png" alt="Gobierno Autónomo Municipal de Cuatro Cañadas" /></div>
      <div className="routePrintTitle"><span>GOBIERNO AUTÓNOMO MUNICIPAL DE CUATRO CAÑADAS</span><h1>HOJA DE RUTA</h1><strong>{route.code}</strong></div>
      <div className="routePrintQr">{qrDataUrl ? <img src={qrDataUrl} alt={`QR de seguimiento ${route.code}`} /> : <span>QR</span>}<small>SEGUIMIENTO DIGITAL</small></div>
    </header>

    <section className="routePrintData">
      <div className="routePrintReceivedAt"><small>FECHA Y HORA</small><strong>{printDate(route.createdAt)} · {printTime(route.createdAt)}</strong></div>
      <div className="routePrintReceiver"><small>RECEPCIONADO POR</small><strong>{receivedBy}</strong></div>
      <div className="routePrintConsignee"><small>CONSIGNATARIO</small><strong>{route.consignee || "No consignado"}</strong></div>
      <div className="routePrintSender"><small>REMITENTE</small><strong>{route.sender}</strong></div>
      <div className="routePrintContact"><small>CONTACTO</small><strong>{contact}</strong></div>
      <div className="routePrintSubject"><small>ASUNTO</small><strong>{route.title}</strong></div>
    </section>

    <section className="routePrintMovements">
      {Array.from({ length: 6 }, (_, index) => <div className="routePrintRow" key={index}>
        <div className="routePrintReception"><h2>RECEPCIÓN <b>{String(index + 1).padStart(2, "0")}</b></h2><span>SELLO Y FIRMA DE RECEPCIÓN</span></div>
        <div className="routePrintDestination">
          <h2><span>DESTINO</span><i /><b>{String(index + 1).padStart(2, "0")}</b></h2>
          <div className="routePrintInstruction"><b>INSTRUCCIÓN</b><small>Proceder, seguir trámite u otra</small></div>
          <div className="routePrintDateTime"><p><b>FECHA</b><i /></p><p><b>HORA</b><i /></p></div>
          <span>FIRMA</span>
        </div>
      </div>)}
    </section>

    <footer className="routePrintFooter"><span>{route.code} · Documento de circulación interna</span><span>Escanee el QR para consultar el estado público del trámite</span></footer>
  </article>;
}

export function RouteWorkflowPanel({
  openRouteModal, filter, setFilter, search, setSearch, visibleRoutes, allRoutes, loading, refresh,
}: {
  openRouteModal: () => void;
  filter: RouteFilter;
  setFilter: (value: RouteFilter) => void;
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
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState("act");
  const [submitting, setSubmitting] = useState(false);
  const [generatedQr, setGeneratedQr] = useState<{ code: string; dataUrl: string } | null>(null);
  const token = access.session?.access_token ?? "";
  const selectedCode = selected?.code;
  const qrDataUrl = generatedQr && generatedQr.code === selectedCode ? generatedQr.dataUrl : "";
  const porRecibir = allRoutes.filter((route) => route.state === "derivado").length;
  const porDerivar = allRoutes.filter((route) => activeForDerivation.has(route.state ?? "")).length;

  useEffect(() => {
    let active = true;
    if (!selectedCode) return () => { active = false; };
    const trackingUrl = `${window.location.origin}/?codigo=${encodeURIComponent(selectedCode)}#seguimiento`;
    QRCode.toDataURL(trackingUrl, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#123f2a", light: "#ffffff" },
    }).then((value) => { if (active) setGeneratedQr({ code: selectedCode, dataUrl: value }); }).catch(() => undefined);
    return () => { active = false; };
  }, [selectedCode]);

  async function openDetail(id?: string) {
    if (!id) return;
    setDetailLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/hojas-ruta/${id}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      const data = (await response.json()) as { item?: RouteDetail; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo abrir el expediente.");
      setSelected(data.item);
      setAction(preferredAction(data.item.state, access.hasPermission));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el expediente.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError("");
    setNotice("");
    const form = new FormData(formElement);
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
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo registrar el movimiento.");
      setSelected(data.item);
      setAction(preferredAction(data.item.state, access.hasPermission));
      setNotice(action === "receive" ? "Recepción confirmada. El trámite ya está listo para gestionar y derivar." : action === "derive" ? `Derivación registrada. ${data.item.currentUnit || data.item.unit} lo verá pendiente de recepción.` : "Movimiento guardado correctamente.");
      refresh();
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el movimiento.");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError("");
    setNotice("");
    const form = new FormData(formElement);
    try {
      const response = await fetch(`/api/hojas-ruta/${selected.id}/adjuntos`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = (await response.json()) as { item?: RouteDetail; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo adjuntar el documento.");
      setSelected(data.item);
      setNotice("Documento adjuntado correctamente.");
      formElement.reset();
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

  const roles = access.context?.roles ?? [];
  const globalRouteAccess = roles.some((role) => (role.module === "platform" || role.module === "sigem") && role.scopeType === "global");
  const hasCurrentUnitAccess = Boolean(selected && (globalRouteAccess || roles.some((role) => role.scopeType === "municipal_unit" && role.scopeId === selected.currentUnitId)));
  const state = selected?.state ?? "";
  const canWork = hasCurrentUnitAccess && activeForDerivation.has(state);
  const allowedActions = [
    hasCurrentUnitAccess && state === "derivado" && access.hasPermission("sigem.routes.receive") && { value: "receive", label: "Recibir trámite" },
    canWork && access.hasPermission("sigem.routes.route") && { value: "derive", label: "Derivar trámite" },
    canWork && access.hasPermission("sigem.routes.update") && { value: "act", label: "Registrar actuación" },
    canWork && access.hasPermission("sigem.routes.update") && { value: "observe", label: "Registrar observación" },
    canWork && access.hasPermission("sigem.routes.update") && { value: "deadline", label: "Cambiar plazo" },
    canWork && access.hasPermission("sigem.routes.close") && { value: "close", label: "Finalizar trámite" },
    hasCurrentUnitAccess && state === "finalizado" && access.hasPermission("sigem.routes.close") && { value: "archive", label: "Archivar expediente" },
    hasCurrentUnitAccess && (state === "finalizado" || state === "archivado") && access.hasPermission("sigem.routes.close") && { value: "reopen", label: "Reabrir expediente" },
  ].filter(Boolean) as Array<{ value: string; label: string }>;
  const descriptionRequired = ["derive", "act", "observe", "close", "reopen"].includes(action);
  const isInitialReview = state === "recibido" && selected?.derivations.length === 0;
  const actionTitle = action === "receive" ? "Confirmar recepción" : action === "derive" ? isInitialReview ? "Registrar primera derivación" : "Derivar a otra unidad" : "Registrar movimiento";
  const currentUnit = selected?.currentUnit || selected?.unit || "Unidad municipal";
  const emptyMessage = filter === "recibir" ? "No tienes trámites pendientes de recibir." : filter === "derivar" ? "No tienes trámites recibidos pendientes de derivar." : "No se encontraron hojas de ruta.";

  return <section className="moduleView routeWorkflow">
    <div className="moduleTitle"><div><span className="routeModuleEyebrow">GESTIÓN DOCUMENTAL</span><h2>Hojas de ruta</h2><p>Recibe, procesa y deriva cada trámite con un recorrido claro entre unidades.</p></div>{access.hasPermission("sigem.routes.create") && <button className="primaryAction" onClick={openRouteModal}><span>＋</span>Nueva hoja de ruta</button>}</div>

    <nav className="routeInboxTabs" aria-label="Bandejas de hojas de ruta">
      <button className={filter === "recibir" ? "selected" : ""} onClick={() => setFilter("recibir")}><span className="routeTabIcon">↓</span><span><strong>Recibir</strong><small>Trámites que llegaron a tu unidad</small></span><b>{porRecibir}</b></button>
      <button className={filter === "derivar" ? "selected" : ""} onClick={() => setFilter("derivar")}><span className="routeTabIcon">→</span><span><strong>Derivar</strong><small>Recibidos y en gestión</small></span><b>{porDerivar}</b></button>
      <button className={filter === "historial" ? "selected" : ""} onClick={() => setFilter("historial")}><span className="routeTabIcon">✓</span><span><strong>Historial</strong><small>Consulta todos los expedientes</small></span><b>{allRoutes.length}</b></button>
    </nav>

    <div className="routeSearchBar"><span>⌕</span><input aria-label="Buscar por código, asunto o remitente" placeholder="Buscar por código, asunto o remitente…" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button onClick={() => setSearch("")}>Limpiar</button>}</div>
    {error && !selected && <p className="formError" role="alert">{error}</p>}
    <section className="panel routeInboxPanel" aria-live="polite">{loading ? <p className="loadingState">Actualizando hojas de ruta…</p> : <div className="routeInboxList">{visibleRoutes.length ? visibleRoutes.map((route) => {
      const isReceive = route.state === "derivado";
      const isDerive = activeForDerivation.has(route.state ?? "");
      return <article className="routeInboxRow" key={route.code}>
        <span className={`routeStateGlyph ${isReceive ? "incoming" : isDerive ? "outgoing" : "history"}`}>{isReceive ? "↓" : isDerive ? "→" : "✓"}</span>
        <div className="routeInboxIdentity"><div><b>{route.code}</b><span className={`routePriority ${route.priority || "normal"}`}>{route.priority || "normal"}</span></div><strong>{route.title}</strong><small>{route.sender}</small></div>
        <div className="routeInboxUnit"><small>{isReceive ? "LLEGÓ A" : isDerive ? "EN GESTIÓN EN" : "UNIDAD ACTUAL"}</small><strong>{route.unit}</strong></div>
        <div className="routeInboxStatus"><span className={route.tone}>{isReceive ? "Pendiente de recibir" : isDerive ? "Listo para derivar" : route.status}</span><small>{route.due}</small></div>
        <button className="routeRowAction" onClick={() => openDetail(route.id)}>{isReceive ? "Recibir" : isDerive ? "Derivar" : "Ver detalle"}<span>›</span></button>
      </article>;
    }) : <div className="routeEmpty"><span>✓</span><h3>Bandeja al día</h3><p>{emptyMessage}</p></div>}</div>}</section>

    {detailLoading && <div className="modalBackdrop"><section className="routeModal"><p className="loadingState">Abriendo expediente…</p></section></div>}
    {selected && <div className="modalBackdrop routeDetailBackdrop no-print" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="routeDetail" role="dialog" aria-modal="true" aria-labelledby="route-detail-title">
      <header className="routeDetailHeader"><div><span>{selected.code}</span><h2 id="route-detail-title">{selected.title}</h2><p>{selected.sender} · {currentUnit}</p></div><div className="routeDetailHeaderActions"><button className="routePrintButton" onClick={() => window.print()} disabled={!qrDataUrl}><span>▤</span>{qrDataUrl ? "Imprimir hoja" : "Preparando QR…"}</button><button onClick={() => setSelected(null)} aria-label="Cerrar expediente">×</button></div></header>
      <div className="routeSummary"><span className={selected.tone}>{selected.status}</span><div><small>Consignatario</small><strong>{selected.consignee || "No consignado"}</strong></div><div><small>Plazo</small><strong>{selected.due}</strong></div><div><small>Prioridad</small><strong>{selected.priority || "Normal"}</strong></div><div><small>Registrado</small><strong>{prettyDate(selected.createdAt)}</strong></div></div>
      {selected.description && <p className="routeDescription">{selected.description}</p>}
      {notice && <p className="formSuccess" role="status">{notice}</p>}
      {error && <p className="formError" role="alert">{error}</p>}
      <div className="routeDetailGrid">
        <div>
          <section className="routeSection"><div className="routeSectionTitle"><div><span>RECORRIDO</span><h3>Recepciones y derivaciones</h3></div><b>{selected.derivations.length} movimiento{selected.derivations.length === 1 ? "" : "s"}</b></div>{selected.derivations.length ? <div className="routeHandoffs">{selected.derivations.map((movement, index) => <article key={movement.id}><span>{selected.derivations.length - index}</span><div><strong>{movement.originUnit || "Secretaría General"} <b>→</b> {movement.destinationUnit}</strong><small>Derivada: {prettyDate(movement.derivedAt)}{movement.receivedAt ? ` · Recibida: ${prettyDate(movement.receivedAt)}` : ""}</small>{movement.note && <p>{movement.note}</p>}</div><em className={movement.state}>{derivationStateLabel(movement.state)}</em></article>)}</div> : <p className="emptyState">Registrada en Secretaría General. Pendiente de revisión y orden para su primera derivación.</p>}</section>
          <section className="routeSection"><h3>Historial del trámite</h3><div className="routeTimeline">{selected.events.map((item) => <article key={item.id}><i /><div><strong>{item.title}</strong><span>{prettyDate(item.createdAt)}{item.actorName ? ` · ${item.actorName}` : ""}</span>{item.description && <p>{item.description}</p>}<small>{item.unit || "Sistema"} · {item.public ? "Visible al ciudadano" : "Uso interno"}</small></div></article>)}</div></section>
          <section className="routeSection"><h3>Documentos adjuntos</h3>{selected.attachments.length ? <div className="attachmentList">{selected.attachments.map((file) => <button key={file.id} onClick={() => downloadAttachment(file)}><span>▧</span><div><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB · {file.public ? "Público" : "Interno"}</small></div><b>Descargar</b></button>)}</div> : <p className="emptyState">Aún no hay documentos adjuntos.</p>}{canWork && access.hasPermission("sigem.routes.update") && <form className="attachmentForm" onSubmit={uploadAttachment}><input type="file" name="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" /><label><input type="checkbox" name="public" /> Visible en seguimiento ciudadano</label><button className="primaryAction" disabled={submitting}>Adjuntar</button></form>}</section>
        </div>
        <aside className="routeActions"><div className="routeActionHeading"><span>{state === "derivado" ? "PASO 1" : isInitialReview ? "REVISIÓN Y ORDEN" : activeForDerivation.has(state) ? "PASO 2" : "EXPEDIENTE"}</span><h3>{actionTitle}</h3><p>{action === "receive" ? "Confirma que tu unidad tiene físicamente la documentación." : action === "derive" ? isInitialReview ? "Deriva únicamente después de que el alcalde o el Secretario Municipal indiquen el destino y la instrucción en la hoja física." : "Selecciona el siguiente destino e indica la instrucción." : "Registra la actuación realizada sobre el trámite."}</p></div>{allowedActions.length ? <form onSubmit={submitAction}>{allowedActions.length > 1 && <label>Operación<select value={action} onChange={(event) => setAction(event.target.value)}>{allowedActions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>}{action === "derive" && <label>Unidad de destino<select name="destinationUnitId" required defaultValue=""><option value="" disabled>Selecciona una unidad</option>{selected.units.filter((unit) => unit.id !== selected.currentUnitId).map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label>}{action === "deadline" && <label>Nueva fecha límite<input name="dueAt" type="date" required /></label>}<label>{action === "derive" ? "Instrucción" : action === "receive" ? "Observación (opcional)" : "Detalle"}<textarea name="description" rows={4} required={descriptionRequired} minLength={descriptionRequired ? 5 : undefined} placeholder={action === "derive" ? "Ej.: Proceder, emitir informe y seguir trámite" : action === "receive" ? "Estado de la documentación recibida" : "Describe la actuación, instrucción o resultado"} /></label>{!["receive", "derive", "deadline", "archive", "reopen"].includes(action) && <label className="inlineCheck"><input type="checkbox" name="public" defaultChecked={action === "close"} /> Mostrar este movimiento al ciudadano</label>}<button className="primaryAction routeSubmitAction" disabled={submitting}>{submitting ? "Guardando…" : action === "receive" ? "Confirmar recepción" : action === "derive" ? isInitialReview ? "Registrar primera derivación →" : "Derivar trámite →" : "Guardar movimiento"}</button></form> : <p className="emptyState">{hasCurrentUnitAccess ? "No hay acciones disponibles para este estado." : "Este expediente ya está en otra unidad. Puedes consultar su historial, pero solamente la unidad actual puede modificarlo."}</p>}<button className="routeSecondaryPrint" onClick={() => window.print()} disabled={!qrDataUrl}>▤ Imprimir hoja física con QR</button><div className="routeContact"><h4>Datos del remitente</h4><span>{selected.sender}</span>{selected.senderPhone && <span>Teléfono: {selected.senderPhone}</span>}{selected.senderEmail && <span>{selected.senderEmail}</span>}</div></aside>
      </div>
      <RoutePrintSheet route={selected} qrDataUrl={qrDataUrl} />
    </section></div>}
  </section>;
}

export function RouteCreateModal({ mode, close, succeed, createdCode }: { mode: "form" | "success"; close: () => void; succeed: (code: string) => void; createdCode: string }) {
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
          remitente: form.get("remitente"), consignatario: form.get("consignatario"), telefono: form.get("telefono"), email: form.get("email"),
          asunto: form.get("asunto"), tipo: form.get("tipo"), prioridad: form.get("prioridad"),
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
    {mode === "success" ? <section className="routeModal successModal" role="dialog" aria-modal="true" aria-labelledby="success-title"><div className="successMark">✓</div><h2 id="success-title">Hoja de ruta registrada</h2><p>Se creó el expediente <strong>{createdCode}</strong> en Secretaría General. Quedó <b>listo para derivar</b> después de la revisión y orden del alcalde o del Secretario Municipal.</p><button className="primaryAction" onClick={close}>Ver pendientes de derivar</button></section>
      : <form className="routeModal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="route-title"><header className="modalHeader"><div><span>SECRETARÍA GENERAL · REGISTRO</span><h2 id="route-title">Nueva hoja de ruta</h2><p>Registra la solicitud sin derivarla. La fecha, hora, código y responsable se guardan automáticamente.</p></div><button type="button" onClick={close} aria-label="Cerrar">×</button></header><label>Remitente<input name="remitente" required maxLength={220} placeholder="Nombre de la persona o institución" /></label><div className="formGrid"><label>Número de contacto<input name="telefono" maxLength={40} placeholder="Teléfono o celular" /></label><label>Correo electrónico (opcional)<input name="email" type="email" maxLength={180} placeholder="correo@ejemplo.com" /></label></div><label>Consignatario<input name="consignatario" required maxLength={220} placeholder="Ej.: Alcalde Municipal o Secretario Municipal" /><small className="fieldHelp">Indica a quién está dirigida la solicitud; esto no genera una derivación.</small></label><label>Asunto<input name="asunto" required maxLength={300} placeholder="Resumen principal del trámite" /></label><div className="formGrid"><label>Tipo<select name="tipo" defaultValue="solicitud_externa"><option value="solicitud_externa">Solicitud externa</option><option value="comunicacion_interna">Comunicación interna</option><option value="solicitud_audiencia">Solicitud de audiencia</option></select></label><label>Prioridad<select name="prioridad" defaultValue="normal"><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label></div><label>Documento inicial (opcional)<input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" /></label><label className="inlineCheck"><input type="checkbox" name="filePublic" /> Visible para el ciudadano durante el seguimiento</label><p className="routeRegistrationNote"><b>Al registrar:</b> quedará en Secretaría General, pendiente de revisión. La primera derivación se hará después desde la bandeja <strong>Derivar</strong>.</p>{error && <p className="formError" role="alert">{error}</p>}<div className="modalActions"><button type="button" onClick={close}>Cancelar</button><button className="primaryAction" type="submit" disabled={submitting}>{submitting ? "Registrando…" : "Registrar hoja de ruta →"}</button></div></form>}
  </div>;
}
