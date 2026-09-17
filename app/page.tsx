"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { addMunicipalDays, capitalizeDateLabel, formatMunicipalDate, getMunicipalIsoDate, getMunicipalYear, parseMunicipalIsoDate } from "../lib/municipal-date";
import { AccessGate, AccessManagement, AccessProvider, useAccess } from "./access";
import { AgendaModule, AgendaSummary, canAccessCabinetAgenda } from "./agenda";
import { MedicalBookingCard, MedicalModule } from "./medical";
import { HumanResourcesModule } from "./recursos-humanos";
import { ProcurementModule } from "./contrataciones";
import { RouteCreateModal, RouteWorkflowPanel, type RouteFilter } from "./hojas-ruta";
import { UiIcon, type UiIconName } from "./ui-icons";
import { useMunicipalDate } from "./use-municipal-date";

type InternalView = "inicio" | "hojas" | "fichas" | "accesos" | "rrhh" | "contrataciones" | "agenda" | "transparencia";

const internalViewMeta: Record<InternalView, { title: string; icon: UiIconName }> = {
  inicio: { title: "Panel principal", icon: "home" },
  hojas: { title: "Gestión documental", icon: "route" },
  fichas: { title: "Salud municipal", icon: "medical" },
  accesos: { title: "Administración de usuarios", icon: "users" },
  rrhh: { title: "Gestión de personal", icon: "people" },
  contrataciones: { title: "Gestión contractual", icon: "procurement" },
  agenda: { title: "Agenda institucional", icon: "calendar" },
  transparencia: { title: "Rendición pública", icon: "transparency" },
};

const services = [
  { number: "01", icon: "route", title: "Seguimiento digital", description: "Consulta el estado de tu hoja de ruta con el código de tu comprobante.", color: "green", target: "seguimiento" },
  { number: "02", icon: "payments", title: "Impuestos y pagos", description: "Consulta obligaciones, pagos y comprobantes municipales.", color: "gold" },
  { number: "03", icon: "medical", title: "Ficha médica virtual", description: "Reserva atención y consulta la información de tu turno.", color: "green", target: "ficha-medica" },
  { number: "04", icon: "services", title: "Requisitos y servicios", description: "Conoce requisitos, horarios y puntos de atención.", color: "gold" },
  { number: "05", icon: "corruption", title: "Denuncia anónima", description: "Informa posibles hechos de corrupción mediante un canal protegido.", color: "green", target: "denuncia" },
  { number: "06", icon: "transparency", title: "Transparencia", description: "Revisa presupuesto, obras, contrataciones y resultados.", color: "gold" },
] as const;

type RouteItem = {
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

type TrackingResult = {
  code: string;
  title: string;
  description?: string | null;
  sender: string;
  unit: string;
  status: string;
  tone: string;
  events: Array<{
    id: string;
    title: string;
    description?: string | null;
    unit?: string | null;
    status: string;
    createdAt: string;
  }>;
  attachments?: Array<{ id: string; name: string; mimeType: string; size: number; createdAt: string }>;
};

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Home() {
  return <AccessProvider><HomeContent /></AccessProvider>;
}

function HomeContent() {
  const access = useAccess();
  const municipalDateKey = useMunicipalDate();
  const municipalDate = useMemo(
    () => municipalDateKey ? parseMunicipalIsoDate(municipalDateKey) : null,
    [municipalDateKey],
  );
  const [portal, setPortal] = useState<"citizen" | "internal">("citizen");
  const [internalView, setInternalView] = useState<InternalView>("inicio");
  const [notice, setNotice] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [routeModal, setRouteModal] = useState<"form" | "success" | null>(null);
  const [routeFilter, setRouteFilter] = useState<RouteFilter>("recibir");
  const [routeSearch, setRouteSearch] = useState("");
  const [routeItems, setRouteItems] = useState<RouteItem[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeDataLive, setRouteDataLive] = useState(false);
  const [routeRefresh, setRouteRefresh] = useState(0);
  const [createdCode, setCreatedCode] = useState("");

  const consultTracking = useCallback(async (rawCode: string, signal?: AbortSignal) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    setTrackingCode(code);
    setTrackingResult(null);
    setTrackingError("");
    setTrackingLoading(true);
    try {
      const response = await fetch(`/api/seguimiento/${encodeURIComponent(code)}`, {
        cache: "no-store",
        signal,
      });
      const data = (await response.json()) as { item?: TrackingResult; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se encontró la solicitud.");
      setTrackingResult(data.item);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setTrackingError(error instanceof Error ? error.message : "No se pudo consultar el seguimiento.");
    } finally {
      if (!signal?.aborted) setTrackingLoading(false);
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const accessRequested = new URLSearchParams(window.location.search).get("access") === "1";
    const authCallback = /(?:^|[&#])type=(?:invite|recovery)(?:&|$)/.test(window.location.hash);
    const accessTimer = accessRequested || authCallback
      ? window.setTimeout(() => setPortal("internal"), 0)
      : null;
    return () => {
      if (accessTimer !== null) window.clearTimeout(accessTimer);
    };
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("codigo")?.trim();
    if (!code) return;

    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("seguimiento")?.scrollIntoView({ block: "start" });
      void consultTracking(code, controller.signal);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [consultTracking]);

  useEffect(() => {
    if (portal !== "internal" || !access.session || !access.hasPermission("sigem.routes.read")) return;
    const accessToken = access.session.access_token;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRouteLoading(true);
      try {
        const response = await fetch("/api/hojas-ruta", {
          signal: controller.signal,
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error("No se pudo consultar la base de datos.");
        const data = (await response.json()) as { items: RouteItem[] };
        setRouteItems(data.items);
        setRouteDataLive(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRouteItems([]);
        setRouteDataLive(false);
      } finally {
        setRouteLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [access, portal, routeRefresh]);

  const visibleRoutes = useMemo(() => {
    const query = routeSearch.trim().toLowerCase();
    return routeItems.filter((route) => {
      const matchesFilter = routeFilter === "historial"
        || (routeFilter === "recibir" ? route.state === "derivado" : ["recibido", "en_proceso", "observado"].includes(route.state ?? ""));
      const matchesSearch = !query || `${route.code} ${route.title} ${route.sender}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [routeFilter, routeItems, routeSearch]);

  function openCitizenPortal() {
    setPortal("citizen");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openInternal(view: InternalView = "inicio") {
    setInternalView(view);
    setPortal("internal");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showServiceNotice(title: string) {
    setNotice(`${title}: este servicio se habilitará en la siguiente etapa.`);
  }

  async function submitTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = trackingCode.trim() || "HR-2026-00481";
    await consultTracking(code);
  }

  if (portal === "internal") {
    const accessReady = Boolean(
      access.session && access.context && !access.needsPassword
      && (!access.context.mfaRequired || access.context.assuranceLevel === "aal2"),
    );
    if (!accessReady) return <AccessGate onBack={openCitizenPortal} />;
    const pressOnly = access.context?.roles.some((role) => role.code === "sigem_prensa") ?? false;
    const primaryAuthorizedView = pressOnly
      ? "agenda"
      : internalView === "inicio"
      && !access.hasPermission("sigem.routes.read")
      && access.hasPermission("health.appointments.read")
      ? "fichas"
      : internalView;
    const authorizedView = primaryAuthorizedView === "agenda" && !canAccessCabinetAgenda(access.context)
      ? "inicio"
      : primaryAuthorizedView;
    return (
      <InternalPortal
        view={authorizedView}
        setView={setInternalView}
        openCitizen={openCitizenPortal}
        openRouteModal={() => access.hasPermission("sigem.routes.create") && setRouteModal("form")}
        filter={routeFilter}
        setFilter={setRouteFilter}
        search={routeSearch}
        setSearch={setRouteSearch}
        visibleRoutes={visibleRoutes}
        allRoutes={routeItems}
        routeLoading={routeLoading}
        routeDataLive={routeDataLive}
        routeModal={routeModal}
        setRouteModal={setRouteModal}
        createdCode={createdCode}
        routeCreated={(code) => {
          setCreatedCode(code);
          setRouteFilter("derivar");
          setRouteModal("success");
          setRouteRefresh((value) => value + 1);
        }}
        refreshRoutes={() => setRouteRefresh((value) => value + 1)}
        today={municipalDate}
      />
    );
  }

  return (
    <div className="citizenPortal">
      <div className="topRibbon">Gobierno Autónomo Municipal de Cuatro Cañadas <span>•</span> Capital Soyera de Bolivia</div>

      <header className="citizenHeader">
        <button className="citizenBrand" onClick={() => scrollToSection("inicio")} aria-label="Inicio Municipio Digital">
          <img src="/marca-cuatro-canadas.png" alt="Cuatro Cañadas, Capital Soyera de Bolivia" />
          <span><strong>Municipio Digital</strong><small>Al servicio de nuestra gente</small></span>
        </button>
        <nav aria-label="Navegación principal">
          <a href="#inicio">Inicio</a>
          <a href="#servicios">Servicios</a>
          <a href="#seguimiento">Seguimiento</a>
          <a href="#denuncia">Denuncia anónima</a>
        </nav>
        <button className="employeeAccess" onClick={() => openInternal()}><UiIcon name="shield" size={17} /> Acceder</button>
      </header>

      <main>
        <section className="hero" id="inicio">
          <i className="heroGlow one" /><i className="heroGlow two" />
          <div className="heroContent">
            <div className="heroKicker"><span><UiIcon name="home" size={14} /></span> GOBIERNO AUTÓNOMO MUNICIPAL DE CUATRO CAÑADAS</div>
            <h1><span>Una gestión</span><br /><em>para todos.</em></h1>
            <p>Accede a los servicios municipales, solicita tu ficha médica y consulta trámites registrados en Secretaría General o en la unidad competente.</p>
            <div className="heroMainActions">
              <button className="heroPrimary" onClick={() => scrollToSection("seguimiento")}><span><UiIcon name="route" size={19} /></span><b>Seguir mi trámite</b><UiIcon name="chevron" size={17} /></button>
              <button className="heroMedical" onClick={() => scrollToSection("ficha-medica")}><span><UiIcon name="medical" size={18} /></span><b>Ficha médica virtual</b><UiIcon name="chevron" size={16} /></button>
              <button className="heroReport" onClick={() => scrollToSection("denuncia")}><span><UiIcon name="corruption" size={18} /></span><b>Denuncia anónima</b><UiIcon name="chevron" size={16} /></button>
            </div>
            <div className="trustLine"><span><UiIcon name="shield" size={15} /></span> Servicios seguros <i /> Disponibles las 24 horas</div>
          </div>

          <article className="heroCard" aria-label="Ejemplo de seguimiento de trámite">
            <div className="heroCardTop"><span>Seguimiento en tiempo real</span><i /></div>
            <div className="caseHeader">
              <div className="caseIcon"><UiIcon name="route" size={22} /></div>
              <div><small>HOJA DE RUTA</small><strong>HR-2026-00481</strong></div>
              <span className="liveBadge">En proceso</span>
            </div>
            <div className="miniTimeline">
              <TimelineItem done title="Solicitud recibida" detail="Secretaría General · 08:42" />
              <TimelineItem done title="Derivada a Comunicación" detail="Recibida · 09:18" />
              <TimelineItem active title="Trabajo en elaboración" detail="Actualizado hace 25 minutos" />
              <TimelineItem title="Respuesta y cierre" detail={municipalDate
                ? `Fecha estimada: ${formatMunicipalDate(addMunicipalDays(municipalDate, 2), { day: "numeric", month: "long" })}`
                : "Fecha estimada: por confirmar"} />
            </div>
            <div className="heroCardFooter"><span>Tiempo estimado</span><strong>2 días hábiles</strong></div>
          </article>
        </section>

        <section className="serviceSection" id="servicios">
          <div className="sectionHeading"><span>SERVICIOS DIGITALES</span><h2>Todo en un solo lugar</h2><p>Información y atención municipal clara, directa y accesible.</p></div>
          <div className="serviceGrid">
            {services.map((service) => (
              <button className="serviceCard" key={service.number} onClick={() => "target" in service ? scrollToSection(service.target) : showServiceNotice(service.title)}>
                <span className={`serviceIcon ${service.color}`}><UiIcon name={service.icon} size={22} /></span><span className="serviceNumber">{service.number}</span><span className="serviceArrow"><UiIcon name="chevron" size={16} /></span>
                <h3>{service.title}</h3><p>{service.description}</p>
              </button>
            ))}
          </div>
        </section>

        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}

        <section className="priorityServices" aria-label="Servicios prioritarios">
          <MedicalBookingCard />
          <article className="priorityCard reportCard" id="denuncia">
            <div className="priorityIcon" aria-hidden="true"><UiIcon name="corruption" size={25} /></div>
            <div><span>TRANSPARENCIA Y LUCHA CONTRA LA CORRUPCIÓN</span><h2>Canal de denuncia protegido</h2><p>Reporta posibles hechos de corrupción sin publicar tu identidad.</p></div>
            <button onClick={() => showServiceNotice("Denuncia anónima de corrupción")}>Ingresar al canal <UiIcon name="chevron" size={16} /></button>
          </article>
        </section>

        <section className="trackingSection" id="seguimiento">
          <div className="trackingCopy"><span>SEGUIMIENTO DIGITAL</span><h2>Consulta tu trámite</h2><p>Ingresa el código entregado al registrar tu documentación para conocer el estado y la unidad responsable.</p></div>
          <form className="trackingForm" onSubmit={submitTracking}>
            <label htmlFor="tracking-code">Código de seguimiento</label>
            <div><input id="tracking-code" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="Ej.: HR-2026-00481" /><button type="submit" disabled={trackingLoading}>{trackingLoading ? "Consultando…" : "Consultar"} <UiIcon name="search" size={17} /></button></div>
            <small>Utiliza el código exacto de tu comprobante.</small>
          </form>
        </section>

        {trackingResult && (
          <section className="trackingResult trackingResultLive" aria-live="polite">
            <div><span className="resultCheck"><UiIcon name="check" size={21} /></span><span><small>SOLICITUD ENCONTRADA · {trackingResult.code}</small><h3>{trackingResult.title}</h3><p>{trackingResult.sender} — {trackingResult.unit}</p></span></div>
            <span className={`liveBadge ${trackingResult.tone}`}>{trackingResult.status}</span>
            <div className="trackingEvents">
              {trackingResult.events.map((event) => <article key={event.id}><i /><span><strong>{event.title}</strong><small>{event.description || event.unit || event.status}</small></span><time>{formatMunicipalDate(event.createdAt, { day: "2-digit", month: "2-digit", year: "numeric" })}</time></article>)}
            </div>
            {Boolean(trackingResult.attachments?.length) && <div className="publicAttachments"><strong>Documentos disponibles</strong>{trackingResult.attachments?.map((file) => <a key={file.id} href={`/api/seguimiento/${encodeURIComponent(trackingResult.code)}/adjuntos/${file.id}`} download>{file.name}<small>{Math.ceil(file.size / 1024)} KB</small></a>)}</div>}
          </section>
        )}
        {trackingError && <p className="trackingError" role="alert">{trackingError}</p>}

        <section className="howSection" id="como-funciona">
          <div className="sectionHeading"><span>SIMPLE Y TRANSPARENTE</span><h2>Tu trámite en tres pasos</h2></div>
          <div className="howGrid"><HowStep number="1" title="Registra" text="Presenta tu documentación en Secretaría General o en la unidad municipal competente." /><HowStep number="2" title="Recibe tu código" text="Al registrar la gestión recibirás una hoja de ruta con un código único." /><HowStep number="3" title="Haz seguimiento" text="Consulta aquí cada avance hasta recibir la respuesta de la unidad responsable." /></div>
        </section>
      </main>

      <footer className="citizenFooter">
        <div><img src="/escudo-gamcc.png" alt="Escudo del Gobierno Autónomo Municipal de Cuatro Cañadas" /><span><strong>Gobierno Autónomo Municipal</strong><small>Cuatro Cañadas · Santa Cruz, Bolivia</small></span></div>
        <p>Trabajo honesto, progreso nuestro.</p><button onClick={() => openInternal()}>Portal interno <UiIcon name="chevron" size={15} /></button>
      </footer>
    </div>
  );
}

function TimelineItem({ done = false, active = false, title, detail }: { done?: boolean; active?: boolean; title: string; detail: string }) {
  return <div className={`timelineItem ${done ? "done" : ""} ${active ? "active" : ""}`}><span className="timelineDot">{done ? <UiIcon name="check" size={13} /> : active ? <i /> : null}</span><div><strong>{title}</strong><span>{detail}</span></div></div>;
}

function HowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div><b>{number}</b><h3>{title}</h3><p>{text}</p></div>;
}

type RouteAlert = { route: RouteItem; label: string; level: "overdue" | "today" | "urgent" };

function getRouteAlerts(items: readonly RouteItem[], today: Date | null): RouteAlert[] {
  const todayKey = today ? today.toISOString().slice(0, 10) : getMunicipalIsoDate();
  return items
    .filter((item) => item.status !== "Finalizado" && item.status !== "Archivado")
    .map((route): RouteAlert | null => {
      const dueKey = route.dueAt ? getMunicipalIsoDate(new Date(route.dueAt)) : null;
      if (dueKey && dueKey < todayKey) return { route, label: "Plazo vencido", level: "overdue" };
      if (dueKey === todayKey) return { route, label: "Vence hoy", level: "today" };
      if (route.priority === "urgente") return { route, label: "Prioridad urgente", level: "urgent" };
      return null;
    })
    .filter((alert): alert is RouteAlert => alert !== null)
    .sort((a, b) => {
      const rank = { overdue: 0, today: 1, urgent: 2 };
      return rank[a.level] - rank[b.level];
    });
}

function InternalPortal({ view, setView, openCitizen, openRouteModal, filter, setFilter, search, setSearch, visibleRoutes, allRoutes, routeLoading, routeDataLive, routeModal, setRouteModal, createdCode, routeCreated, refreshRoutes, today }: {
  view: InternalView;
  setView: (view: InternalView) => void;
  openCitizen: () => void;
  openRouteModal: () => void;
  filter: RouteFilter;
  setFilter: (filter: RouteFilter) => void;
  search: string;
  setSearch: (value: string) => void;
  visibleRoutes: readonly RouteItem[];
  allRoutes: readonly RouteItem[];
  routeLoading: boolean;
  routeDataLive: boolean;
  routeModal: "form" | "success" | null;
  setRouteModal: (value: "form" | "success" | null) => void;
  createdCode: string;
  routeCreated: (code: string) => void;
  refreshRoutes: () => void;
  today: Date | null;
}) {
  const access = useAccess();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const currentView = internalViewMeta[view];
  const canManageUsers = access.hasPermission("platform.users.manage") || access.hasPermission("sigem.users.manage") || access.hasPermission("health.users.manage");
  const canAccessAgenda = canAccessCabinetAgenda(access.context);
  const pressOnly = access.context?.roles.some((role) => role.code === "sigem_prensa") ?? false;
  const mayorReadOnly = access.context?.roles.some((role) => role.code === "sigem_alcalde") ?? false;
  const canCreateRoutes = access.hasPermission("sigem.routes.create");
  const greetingName = access.context?.profile.fullName.trim().split(/\s+/)[0] || "usuario";
  const initials = access.context?.profile.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "US";
  const routeAlerts = getRouteAlerts(allRoutes, today);
  const routesToReceive = allRoutes.filter((route) => route.state === "derivado").length;
  const routesToDerive = allRoutes.filter((route) => ["recibido", "en_proceso", "observado"].includes(route.state ?? "")).length;

  function openRoute(route: RouteItem) {
    setSearch(route.code);
    setFilter("historial");
    setView("hojas");
    setNotificationsOpen(false);
  }
  return (
    <div className="internalShell">
      <aside className="sidebar">
        <button className="brandButton" onClick={openCitizen} aria-label="Volver al portal ciudadano"><img src="/marca-cuatro-canadas.png" alt="Cuatro Cañadas" /></button>
        <div className="sideLabel">GESTIÓN MUNICIPAL</div>
        <nav className="sideNav" aria-label="Navegación interna">
          {!pressOnly && <SideButton active={view === "inicio"} icon="home" label="Inicio" onClick={() => setView("inicio")} />}
          {access.hasPermission("sigem.routes.read") && <><SideButton active={view === "hojas"} icon="route" label="Hojas de ruta" badge={mayorReadOnly ? undefined : String(routesToReceive)} onClick={() => { if (mayorReadOnly) setFilter("historial"); setView("hojas"); }} />{view === "hojas" && <div className="sideSubNav" aria-label="Submenú de hojas de ruta">{!mayorReadOnly && <><button className={filter === "recibir" ? "active" : ""} onClick={() => setFilter("recibir")}><span><UiIcon name="receive" size={15} /></span> Recibir <b>{routesToReceive}</b></button><button className={filter === "derivar" ? "active" : ""} onClick={() => setFilter("derivar")}><span><UiIcon name="send" size={15} /></span> Derivar <b>{routesToDerive}</b></button></>}<button className={filter === "historial" ? "active" : ""} onClick={() => setFilter("historial")}><span><UiIcon name="history" size={15} /></span> {mayorReadOnly ? "Consulta general" : "Historial"}</button></div>}</>}
          {access.hasPermission("health.appointments.read") && <SideButton active={view === "fichas"} icon="medical" label="Fichas médicas" onClick={() => setView("fichas")} />}
          {canManageUsers && <SideButton active={view === "accesos"} icon="users" label="Usuarios" onClick={() => setView("accesos")} />}
          {access.hasPermission("sigem.hr.read") && <SideButton active={view === "rrhh"} icon="people" label="Recursos Humanos" onClick={() => setView("rrhh")} />}
          {access.hasPermission("sigem.routes.read") && <SideButton active={view === "contrataciones"} icon="procurement" label="Contrataciones" onClick={() => setView("contrataciones")} />}
          {canAccessAgenda && <SideButton active={view === "agenda"} icon="calendar" label="Agenda institucional" onClick={() => setView("agenda")} />}
          {access.hasPermission("sigem.reports.read") && <SideButton active={view === "transparencia"} icon="transparency" label="Transparencia" onClick={() => setView("transparencia")} />}
        </nav>
        <div className="sidebarFooter"><span className="avatar small">{initials}</span><div><strong>{access.context?.profile.fullName}</strong><span>{access.context?.profile.jobTitle || access.context?.roles[0]?.name}</span></div><button onClick={access.signOut} aria-label="Cerrar sesión"><UiIcon name="logout" size={18} /></button></div>
      </aside>

      <main className="internalMain">
        <header className="internalHeader"><div className="internalPageIdentity"><span className="pageIdentityIcon"><UiIcon name={currentView.icon} size={23} /></span><div><span className="sectionKicker">GAMCC · GESTIÓN INTERNA</span><h1>{currentView.title}</h1></div></div><div className="headerActions"><span className="demoPill live" title={routeDataLive ? "Datos municipales conectados" : "Acceso institucional verificado"}><UiIcon name="shield" size={15} /> Acceso protegido</span><div className="notificationMenu"><button className="iconButton" aria-label={`Notificaciones: ${routeAlerts.length} pendientes`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><UiIcon name="bell" size={19} />{routeAlerts.length > 0 && <span className="notificationCount">{routeAlerts.length > 9 ? "9+" : routeAlerts.length}</span>}</button>{notificationsOpen && <section className="notificationPanel" aria-label="Alertas de hojas de ruta"><header><div><span>ALERTAS</span><strong>Requieren atención</strong></div><button onClick={() => setNotificationsOpen(false)} aria-label="Cerrar alertas">×</button></header><div className="notificationList">{routeAlerts.length ? routeAlerts.slice(0, 6).map((alert) => <button key={alert.route.code} onClick={() => openRoute(alert.route)}><i className={alert.level} /><span><strong>{alert.label}</strong><small>{alert.route.code} · {alert.route.title}</small></span><UiIcon name="chevron" size={15} /></button>) : <p>No tienes alertas pendientes.</p>}</div>{routeAlerts.length > 0 && <button className="notificationFooter" onClick={() => { setView("hojas"); setFilter("historial"); setNotificationsOpen(false); }}>Ver bandeja completa <UiIcon name="chevron" size={14} /></button>}</section>}</div><button className="portalLink" onClick={openCitizen}>Portal ciudadano <UiIcon name="external" size={15} /></button></div></header>
        {view === "inicio" && <Dashboard setView={(nextView) => { if (nextView === "hojas" && mayorReadOnly) setFilter("historial"); setView(nextView); }} openRouteModal={openRouteModal} items={allRoutes} userName={greetingName} today={today} canAccessAgenda={canAccessAgenda} canCreateRoutes={canCreateRoutes} openRoute={openRoute} />}
        {view === "hojas" && <RoutesModule openRouteModal={openRouteModal} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} visibleRoutes={visibleRoutes} allRoutes={allRoutes} loading={routeLoading} refresh={refreshRoutes} />}
        {view === "fichas" && <MedicalModule />}
        {view === "accesos" && <AccessManagement />}
        {view === "rrhh" && <HumanResourcesModule />}
        {view === "contrataciones" && <ProcurementModule />}
        {view === "agenda" && <AgendaModule today={today} />}
        {view === "transparencia" && <TransparencyModule today={today} />}
      </main>
      {routeModal && canCreateRoutes && <RouteCreateModal mode={routeModal} close={() => setRouteModal(null)} succeed={routeCreated} createdCode={createdCode} />}
    </div>
  );
}

function SideButton({ active, icon, label, badge, onClick }: { active: boolean; icon: UiIconName; label: string; badge?: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span className="navIcon"><UiIcon name={icon} size={19} /></span><span>{label}</span>{badge ? <b>{badge}</b> : null}</button>;
}

function Dashboard({ setView, openRouteModal, items, userName, today, canAccessAgenda, canCreateRoutes, openRoute }: { setView: (view: InternalView) => void; openRouteModal: () => void; items: readonly RouteItem[]; userName: string; today: Date | null; canAccessAgenda: boolean; canCreateRoutes: boolean; openRoute: (route: RouteItem) => void }) {
  const pendientes = items.filter((item) => item.status !== "Finalizado" && item.status !== "Archivado");
  const finalizados = items.length - pendientes.length;
  const alertas = getRouteAlerts(items, today);
  const urgentes = pendientes.filter((item) => item.priority === "urgente").length;
  const dateLabel = today
    ? capitalizeDateLabel(formatMunicipalDate(today, { weekday: "long", day: "numeric", month: "long" }))
    : "Fecha actual";
  const shortDateLabel = today
    ? formatMunicipalDate(today, { day: "numeric", month: "long" })
    : "fecha actual";
  return <>
    <section className="welcomeRow"><div><p className="dateLine">{dateLabel}</p><h2>Hola, {userName}.</h2><p>{alertas.length ? <><strong>{alertas.length} {alertas.length === 1 ? "asunto prioritario" : "asuntos prioritarios"}</strong> requieren atención.</> : <>Tu bandeja prioritaria está al día.</>}</p></div>{canCreateRoutes ? <button className="primaryAction" onClick={openRouteModal}><UiIcon name="plus" size={17} />Nueva hoja de ruta</button> : null}</section>
    <section className="statGrid" aria-label="Resumen del trabajo"><StatCard color="blue" icon="inbox" label="En bandeja" value={String(items.length)} note="Total asignado" /><StatCard color="orange" icon="alert" label="Prioridad urgente" value={String(urgentes)} note="Con plazo crítico" /><StatCard color="green" icon="check" label="Finalizadas" value={String(finalizados)} note="Procesos cerrados" /><StatCard color="violet" icon="clock" label="Pendientes" value={String(pendientes.length)} note="En gestión" /></section>
    <div className={`dashboardGrid ${canAccessAgenda ? "" : "single"}`}><section className="panel panelElevated"><PanelHeader icon="route" eyebrow="GESTIÓN DOCUMENTAL" title="Requieren tu atención" action="Ver bandeja" onClick={() => setView("hojas")} /><RouteList items={alertas.map((alert) => alert.route).slice(0, 3)} onOpen={openRoute} /></section>{canAccessAgenda ? <section className="panel agendaPanel panelElevated"><PanelHeader icon="calendar" eyebrow="AGENDA INSTITUCIONAL" title={`Hoy, ${shortDateLabel}`} action="Abrir" onClick={() => setView("agenda")} /><AgendaSummary today={today} onOpen={() => setView("agenda")} /></section> : null}</div>
  </>;
}

function StatCard({ color, icon, label, value, note }: { color: string; icon: UiIconName; label: string; value: string; note: string }) {
  return <article className={`statCard ${color}`}><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><span className="statCardIcon"><UiIcon name={icon} size={20} /></span></article>;
}

function PanelHeader({ icon, eyebrow, title, action, onClick }: { icon: UiIconName; eyebrow: string; title: string; action: string; onClick: () => void }) {
  return <header className="panelHeader"><div className="panelTitleGroup"><span className="panelTitleIcon"><UiIcon name={icon} size={18} /></span><div><span className="panelEyebrow">{eyebrow}</span><h3>{title}</h3></div></div><button onClick={onClick}>{action}<UiIcon name="chevron" size={14} /></button></header>;
}

function RouteList({ items, full = false, onOpen }: { items: readonly RouteItem[]; full?: boolean; onOpen?: (route: RouteItem) => void }) {
  return <div className={`inboxList ${full ? "full" : ""}`}>{items.length ? items.map((route) => <article className="inboxRow" key={route.code}><span className="docGlyph"><UiIcon name="document" size={19} /></span><div className="inboxIdentity"><strong>{route.title}</strong><span>{route.sender} · <b>{route.code}</b></span></div><span className="unitPill">{route.unit}</span><div className="inboxStatus"><span className={route.tone}>{route.status}</span><small>{route.due}</small></div><button aria-label={`Abrir ${route.code}`} onClick={() => onOpen?.(route)}><UiIcon name="chevron" size={17} /></button></article>) : <p className="emptyState">No hay hojas de ruta que requieran atención.</p>}</div>;
}

function RoutesModule({ openRouteModal, filter, setFilter, search, setSearch, visibleRoutes, allRoutes, loading, refresh }: { openRouteModal: () => void; filter: RouteFilter; setFilter: (value: RouteFilter) => void; search: string; setSearch: (value: string) => void; visibleRoutes: readonly RouteItem[]; allRoutes: readonly RouteItem[]; loading: boolean; refresh: () => void }) {
  return <RouteWorkflowPanel openRouteModal={openRouteModal} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} visibleRoutes={visibleRoutes} allRoutes={allRoutes} loading={loading} refresh={refresh} />;
}

function TransparencyModule({ today }: { today: Date | null }) {
  const access = useAccess();
  const canPublish = access.hasPermission("platform.users.manage") || access.hasPermission("sigem.users.manage");
  const year = today?.getUTCFullYear() ?? getMunicipalYear();
  const dateLabel = today ? formatMunicipalDate(today, { day: "numeric", month: "long" }) : "fecha actual";
  return <section className="moduleView"><div className="moduleTitle"><div><span className="moduleEyebrow">TRANSPARENCIA</span><h2>Ejecución e indicadores</h2><p>Información pública preparada para la ciudadanía.</p></div>{canPublish ? <button className="primaryAction"><UiIcon name="plus" size={17} />Publicar actualización</button> : null}</div><section className="transparencyHero"><div><span>EJECUCIÓN PRESUPUESTARIA {year}</span><strong>62,8%</strong><p>Información demostrativa pendiente de conexión con la fuente oficial.</p></div><div className="donut"><span>63<small>%</small></span></div></section><div className="statGrid"><StatCard color="blue" icon="inbox" label="Presupuesto vigente" value="Bs 84,2 M" note={`Gestión ${year}`} /><StatCard color="green" icon="check" label="Ejecutado" value="Bs 52,9 M" note={`Al ${dateLabel}`} /><StatCard color="orange" icon="clock" label="Proyectos activos" value="38" note="12 con avance público" /><StatCard color="violet" icon="transparency" label="Procesos publicados" value="117" note="Sincronización pendiente" /></div></section>;
}
