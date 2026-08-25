"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { addMunicipalDays, capitalizeDateLabel, formatMunicipalDate, getMunicipalYear, parseMunicipalIsoDate } from "../lib/municipal-date";
import { AccessGate, AccessManagement, AccessProvider, useAccess } from "./access";
import { MedicalBookingCard, MedicalModule } from "./medical";
import { useMunicipalDate } from "./use-municipal-date";

type InternalView = "inicio" | "hojas" | "fichas" | "accesos" | "contrataciones" | "agenda" | "transparencia";

const services = [
  { number: "01", title: "Seguimiento digital", description: "Consulta el estado de tu hoja de ruta con el código de tu comprobante.", color: "green", target: "seguimiento" },
  { number: "02", title: "Impuestos y pagos", description: "Consulta obligaciones, pagos y comprobantes municipales.", color: "orange" },
  { number: "03", title: "Ficha médica virtual", description: "Obtén una ficha de atención y consulta la información de tu turno.", color: "blue", target: "ficha-medica" },
  { number: "04", title: "Requisitos y servicios", description: "Conoce requisitos, horarios y lugares de atención antes de acudir.", color: "violet" },
  { number: "05", title: "Denuncia anónima", description: "Informa posibles hechos de corrupción mediante un canal protegido.", color: "pink", target: "denuncia" },
  { number: "06", title: "Transparencia", description: "Revisa presupuesto, obras, contrataciones y resultados.", color: "navy" },
] as const;

const fallbackRoutes = [
  { code: "HR-2026-00481", title: "Solicitud de spot para feria educativa", sender: "U.E. Nacional Cuatro Cañadas", unit: "Comunicación", status: "Urgente", due: "Vence hoy", tone: "danger" },
  { code: "HR-2026-00477", title: "Solicitud de mantenimiento de alumbrado", sender: "OTB 15 de Agosto", unit: "Obras Públicas", status: "En proceso", due: "2 días restantes", tone: "progress" },
  { code: "HR-2026-00469", title: "Solicitud de apoyo técnico productivo", sender: "Asociación de productores", unit: "Desarrollo Agropecuario", status: "Recibido", due: "3 días restantes", tone: "received" },
  { code: "HR-2026-00454", title: "Certificación de datos catastrales", sender: "María Elena Vargas", unit: "Catastro", status: "Finalizado", due: "Respondido hoy", tone: "done" },
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
};

const events = [
  { time: "08:30", title: "Reunión con directores", place: "Sala de Gabinete", color: "green" },
  { time: "10:00", title: "Audiencia — Central 4 Este", place: "Despacho del Alcalde", color: "blue" },
  { time: "14:30", title: "Inspección avance de obra", place: "Unidad Educativa San Antonio", color: "orange" },
] as const;

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
  const [routeFilter, setRouteFilter] = useState<"todos" | "pendientes" | "finalizados">("todos");
  const [routeSearch, setRouteSearch] = useState("");
  const [routeItems, setRouteItems] = useState<RouteItem[]>([...fallbackRoutes]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeDataLive, setRouteDataLive] = useState(false);
  const [routeRefresh, setRouteRefresh] = useState(0);
  const [createdCode, setCreatedCode] = useState("");

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
        setRouteItems([...fallbackRoutes]);
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
      const matchesFilter = routeFilter === "todos" || (routeFilter === "finalizados" ? route.status === "Finalizado" : route.status !== "Finalizado");
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
    setTrackingCode(code);
    setTrackingResult(null);
    setTrackingError("");
    setTrackingLoading(true);
    try {
      const response = await fetch(`/api/seguimiento/${encodeURIComponent(code.toUpperCase())}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { item?: TrackingResult; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se encontró la solicitud.");
      setTrackingResult(data.item);
    } catch (error) {
      setTrackingError(error instanceof Error ? error.message : "No se pudo consultar el seguimiento.");
    } finally {
      setTrackingLoading(false);
    }
  }

  if (portal === "internal") {
    const accessReady = Boolean(
      access.session && access.context && !access.needsPassword
      && (!access.context.mfaRequired || access.context.assuranceLevel === "aal2"),
    );
    if (!accessReady) return <AccessGate onBack={openCitizenPortal} />;
    const authorizedView = internalView === "inicio"
      && !access.hasPermission("sigem.routes.read")
      && access.hasPermission("health.appointments.read")
      ? "fichas"
      : internalView;
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
          setRouteModal("success");
          setRouteRefresh((value) => value + 1);
        }}
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
        <button className="employeeAccess" onClick={() => openInternal()}><span>◎</span> Acceder</button>
      </header>

      <main>
        <section className="hero" id="inicio">
          <i className="heroGlow one" /><i className="heroGlow two" />
          <div className="heroContent">
            <div className="heroKicker"><i /> GOBIERNO AUTÓNOMO MUNICIPAL DE CUATRO CAÑADAS</div>
            <h1><span>Una gestión</span><br /><em>para todos.</em></h1>
            <p>Servicios e información municipal más cerca de la gente. Los trámites se registran en Secretaría General o en la unidad competente y pueden seguirse aquí con total claridad.</p>
            <div className="heroMainActions">
              <button className="heroPrimary" onClick={() => scrollToSection("seguimiento")}>Seguir mi trámite <span>→</span></button>
              <button className="heroMedical" onClick={() => scrollToSection("ficha-medica")}><span>✚</span> Saca tu ficha médica virtual aquí <b>›</b></button>
              <button className="heroReport" onClick={() => scrollToSection("denuncia")}><span>!</span> Denuncia corrupción de forma anónima <b>›</b></button>
            </div>
            <div className="trustLine"><span>✓</span> Seguimiento transparente <span>✓</span> Disponible las 24 horas</div>
          </div>

          <article className="heroCard" aria-label="Ejemplo de seguimiento de trámite">
            <div className="heroCardTop"><span>Seguimiento en tiempo real</span><i /></div>
            <div className="caseHeader">
              <div className="caseIcon">HR</div>
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
          <div className="sectionHeading"><span>SERVICIOS DIGITALES</span><h2>El municipio más cerca de ti</h2><p>Consulta información, accede a servicios y realiza el seguimiento de gestiones ya registradas.</p></div>
          <div className="serviceGrid">
            {services.map((service) => (
              <button className="serviceCard" key={service.number} onClick={() => "target" in service ? scrollToSection(service.target) : showServiceNotice(service.title)}>
                <span className={`serviceIcon ${service.color}`}>{service.number}</span><span className="serviceArrow">↗</span>
                <h3>{service.title}</h3><p>{service.description}</p>
              </button>
            ))}
          </div>
        </section>

        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}

        <section className="priorityServices" aria-label="Servicios prioritarios">
          <MedicalBookingCard />
          <article className="priorityCard reportCard" id="denuncia">
            <div className="priorityIcon" aria-hidden="true">!</div>
            <div><span>TRANSPARENCIA Y LUCHA CONTRA LA CORRUPCIÓN</span><h2>Denuncia anónima y protegida</h2><p>Reporta posibles hechos de corrupción sin publicar tu identidad. El canal especializado estará separado de los trámites administrativos.</p></div>
            <button onClick={() => showServiceNotice("Denuncia anónima de corrupción")}>Ir al canal de denuncia <span>→</span></button>
          </article>
        </section>

        <section className="trackingSection" id="seguimiento">
          <div className="trackingCopy"><span>SEGUIMIENTO DIGITAL</span><h2>¿Tu trámite ya fue registrado?</h2><p>Ingresa el código entregado por Secretaría General o la unidad que recibió tu documentación para conocer su estado y responsable.</p></div>
          <form className="trackingForm" onSubmit={submitTracking}>
            <label htmlFor="tracking-code">Código de seguimiento</label>
            <div><input id="tracking-code" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="Ej.: HR-2026-00481" /><button type="submit" disabled={trackingLoading}>{trackingLoading ? "Consultando…" : "Consultar"} <span>→</span></button></div>
            <small>Consulta el código exacto entregado al registrar tu solicitud.</small>
          </form>
        </section>

        {trackingResult && (
          <section className="trackingResult trackingResultLive" aria-live="polite">
            <div><span className="resultCheck">✓</span><span><small>SOLICITUD ENCONTRADA · {trackingResult.code}</small><h3>{trackingResult.title}</h3><p>{trackingResult.sender} — {trackingResult.unit}</p></span></div>
            <span className={`liveBadge ${trackingResult.tone}`}>{trackingResult.status}</span>
            <div className="trackingEvents">
              {trackingResult.events.map((event) => <article key={event.id}><i /><span><strong>{event.title}</strong><small>{event.description || event.unit || event.status}</small></span><time>{formatMunicipalDate(event.createdAt, { day: "2-digit", month: "2-digit", year: "numeric" })}</time></article>)}
            </div>
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
        <p>Trabajo honesto, progreso nuestro.</p><button onClick={() => openInternal()}>Portal interno →</button>
      </footer>
    </div>
  );
}

function TimelineItem({ done = false, active = false, title, detail }: { done?: boolean; active?: boolean; title: string; detail: string }) {
  return <div className={`timelineItem ${done ? "done" : ""} ${active ? "active" : ""}`}><span className="timelineDot">{done ? "✓" : ""}</span><div><strong>{title}</strong><span>{detail}</span></div></div>;
}

function HowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div><b>{number}</b><h3>{title}</h3><p>{text}</p></div>;
}

function InternalPortal({ view, setView, openCitizen, openRouteModal, filter, setFilter, search, setSearch, visibleRoutes, allRoutes, routeLoading, routeDataLive, routeModal, setRouteModal, createdCode, routeCreated, today }: {
  view: InternalView;
  setView: (view: InternalView) => void;
  openCitizen: () => void;
  openRouteModal: () => void;
  filter: "todos" | "pendientes" | "finalizados";
  setFilter: (filter: "todos" | "pendientes" | "finalizados") => void;
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
  today: Date | null;
}) {
  const access = useAccess();
  const titles: Record<InternalView, string> = { inicio: "Panel de gestión", hojas: "Hojas de ruta", fichas: "Fichas médicas", accesos: "Usuarios y accesos", contrataciones: "Contrataciones", agenda: "Agenda institucional", transparencia: "Transparencia" };
  const canManageUsers = access.hasPermission("platform.users.manage") || access.hasPermission("sigem.users.manage") || access.hasPermission("health.users.manage");
  const greetingName = access.context?.profile.fullName.trim().split(/\s+/)[0] || "usuario";
  const initials = access.context?.profile.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "US";
  return (
    <div className="internalShell">
      <aside className="sidebar">
        <button className="brandButton" onClick={openCitizen} aria-label="Volver al portal ciudadano"><img src="/marca-cuatro-canadas.png" alt="Cuatro Cañadas" /></button>
        <div className="sideLabel">GESTIÓN MUNICIPAL</div>
        <nav className="sideNav" aria-label="Navegación interna">
          <SideButton active={view === "inicio"} icon="⌂" label="Inicio" onClick={() => setView("inicio")} />
          {access.hasPermission("sigem.routes.read") && <SideButton active={view === "hojas"} icon="↗" label="Hojas de ruta" badge={String(allRoutes.length)} onClick={() => setView("hojas")} />}
          {access.hasPermission("health.appointments.read") && <SideButton active={view === "fichas"} icon="✚" label="Fichas médicas" onClick={() => setView("fichas")} />}
          {canManageUsers && <SideButton active={view === "accesos"} icon="♙" label="Usuarios y accesos" onClick={() => setView("accesos")} />}
          {access.hasPermission("sigem.routes.read") && <SideButton active={view === "contrataciones"} icon="▣" label="Contrataciones" onClick={() => setView("contrataciones")} />}
          {access.hasPermission("sigem.routes.read") && <SideButton active={view === "agenda"} icon="□" label="Agenda" onClick={() => setView("agenda")} />}
          {access.hasPermission("sigem.reports.read") && <SideButton active={view === "transparencia"} icon="◎" label="Transparencia" onClick={() => setView("transparencia")} />}
        </nav>
        <div className="sidebarFooter"><span className="avatar small">{initials}</span><div><strong>{access.context?.profile.fullName}</strong><span>{access.context?.profile.jobTitle || access.context?.roles[0]?.name}</span></div><button onClick={access.signOut} aria-label="Cerrar sesión">↪</button></div>
      </aside>

      <main className="internalMain">
        <header className="internalHeader"><div><span className="sectionKicker">MUNICIPIO DIGITAL</span><h1>{titles[view]}</h1></div><div className="headerActions"><span className="demoPill live" title={routeDataLive ? "Datos municipales conectados" : "Acceso institucional verificado"}><i /> Acceso protegido · 2FA</span><button className="iconButton" aria-label="Notificaciones">●<span className="notificationDot" /></button><button className="portalLink" onClick={openCitizen}>Ver portal ciudadano</button></div></header>
        {view === "inicio" && <Dashboard setView={setView} openRouteModal={openRouteModal} items={allRoutes} userName={greetingName} today={today} />}
        {view === "hojas" && <RoutesModule openRouteModal={openRouteModal} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} visibleRoutes={visibleRoutes} allRoutes={allRoutes} loading={routeLoading} />}
        {view === "fichas" && <MedicalModule />}
        {view === "accesos" && <AccessManagement />}
        {view === "contrataciones" && <ProcurementModule openRouteModal={openRouteModal} />}
        {view === "agenda" && <AgendaModule today={today} />}
        {view === "transparencia" && <TransparencyModule today={today} />}
      </main>
      {routeModal && <RouteModal mode={routeModal} close={() => setRouteModal(null)} succeed={routeCreated} createdCode={createdCode} />}
    </div>
  );
}

function SideButton({ active, icon, label, badge, onClick }: { active: boolean; icon: string; label: string; badge?: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span className="navIcon">{icon}</span><span>{label}</span>{badge && <b>{badge}</b>}</button>;
}

function Dashboard({ setView, openRouteModal, items, userName, today }: { setView: (view: InternalView) => void; openRouteModal: () => void; items: readonly RouteItem[]; userName: string; today: Date | null }) {
  const pendientes = items.filter((item) => item.status !== "Finalizado" && item.status !== "Archivado");
  const finalizados = items.length - pendientes.length;
  const urgentes = items.filter((item) => item.priority === "urgente").length;
  const dateLabel = today
    ? capitalizeDateLabel(formatMunicipalDate(today, { weekday: "long", day: "numeric", month: "long" }))
    : "Fecha actual";
  const shortDateLabel = today
    ? formatMunicipalDate(today, { day: "numeric", month: "long" })
    : "fecha actual";
  return <>
    <section className="welcomeRow"><div><p className="dateLine">{dateLabel}</p><h2>Buenos días, {userName}.</h2><p>Tienes <strong>3 asuntos prioritarios</strong> que requieren atención.</p></div><button className="primaryAction" onClick={openRouteModal}><span>＋</span>Nueva hoja de ruta</button></section>
    <section className="statGrid" aria-label="Resumen del trabajo"><StatCard color="blue" label="En mi bandeja" value={String(items.length)} note="Registros disponibles" /><StatCard color="orange" label="Prioridad urgente" value={String(urgentes)} note="Requieren atención" /><StatCard color="green" label="Finalizadas" value={String(finalizados)} note="En la bandeja actual" /><StatCard color="violet" label="Pendientes" value={String(pendientes.length)} note="En seguimiento" /></section>
    <div className="dashboardGrid"><section className="panel"><PanelHeader eyebrow="HOJA DE RUTA" title="Requieren tu atención" action="Ver toda la bandeja →" onClick={() => setView("hojas")} /><RouteList items={pendientes.slice(0, 3)} /></section><section className="panel agendaPanel"><PanelHeader eyebrow="AGENDA DEL ALCALDE" title={`Hoy, ${shortDateLabel}`} action="↗" onClick={() => setView("agenda")} /><AgendaList /><button className="subtleAction" onClick={() => setView("agenda")}>＋ Agendar audiencia</button></section></div>
    <section className="panel procurementPanel"><PanelHeader eyebrow="CONTRATACIÓN EN CURSO" title="Servicio de impresión — Invitaciones aniversario municipal" action="CM-2026-0038" onClick={() => setView("contrataciones")} /><div className="stepTrack"><ProcessStep complete number="✓" title="Necesidad registrada" note="Unidad de Comunicación" /><ProcessStep complete number="✓" title="Certificación presupuestaria" note="CP-2026-0184 aprobada" /><ProcessStep number="3" title="Inicio de contratación" note="Pendiente de visto bueno" /><ProcessStep number="4" title="Orden de servicio" note="Aún no iniciada" /></div></section>
  </>;
}

function StatCard({ color, label, value, note }: { color: string; label: string; value: string; note: string }) {
  return <article className={`statCard ${color}`}><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><i /></article>;
}

function PanelHeader({ eyebrow, title, action, onClick }: { eyebrow: string; title: string; action: string; onClick: () => void }) {
  return <header className="panelHeader"><div><span className="panelEyebrow">{eyebrow}</span><h3>{title}</h3></div><button onClick={onClick}>{action}</button></header>;
}

function RouteList({ items, full = false }: { items: readonly RouteItem[]; full?: boolean }) {
  return <div className={`inboxList ${full ? "full" : ""}`}>{items.length ? items.map((route) => <article className="inboxRow" key={route.code}><span className="docGlyph">▤</span><div className="inboxIdentity"><strong>{route.title}</strong><span>{route.sender} · <b>{route.code}</b></span></div><span className="unitPill">{route.unit}</span><div className="inboxStatus"><span className={route.tone}>{route.status}</span><small>{route.due}</small></div><button aria-label={`Abrir ${route.code}`}>›</button></article>) : <p className="emptyState">No se encontraron hojas de ruta.</p>}</div>;
}

function AgendaList() {
  return <div className="agendaList">{events.map((event) => <article className="agendaItem" key={event.time}><time>{event.time}</time><i className={`agendaMark ${event.color}`} /><div><strong>{event.title}</strong><span>{event.place}</span></div></article>)}</div>;
}

function ProcessStep({ complete = false, number, title, note }: { complete?: boolean; number: string; title: string; note: string }) {
  return <div className={`processStep ${complete ? "complete" : ""}`}><div className="stepTop"><span>{number}</span><i /></div><strong>{title}</strong><small>{note}</small></div>;
}

function RoutesModule({ openRouteModal, filter, setFilter, search, setSearch, visibleRoutes, allRoutes, loading }: { openRouteModal: () => void; filter: "todos" | "pendientes" | "finalizados"; setFilter: (value: "todos" | "pendientes" | "finalizados") => void; search: string; setSearch: (value: string) => void; visibleRoutes: readonly RouteItem[]; allRoutes: readonly RouteItem[]; loading: boolean }) {
  const finalizados = allRoutes.filter((route) => route.status === "Finalizado" || route.status === "Archivado").length;
  const pendientes = allRoutes.length - finalizados;
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Bandeja de hojas de ruta</h2><p>Solicitudes reales registradas y derivadas a las unidades municipales</p></div><button className="primaryAction" onClick={openRouteModal}><span>＋</span>Nueva hoja de ruta</button></div><div className="filterBar"><input aria-label="Buscar por código, asunto o remitente" placeholder="Buscar por código, asunto o remitente" value={search} onChange={(event) => setSearch(event.target.value)} /><button className={filter === "todos" ? "selected" : ""} onClick={() => setFilter("todos")}>Todos {allRoutes.length}</button><button className={filter === "pendientes" ? "selected" : ""} onClick={() => setFilter("pendientes")}>Pendientes {pendientes}</button><button className={filter === "finalizados" ? "selected" : ""} onClick={() => setFilter("finalizados")}>Finalizados {finalizados}</button></div><section className="panel">{loading ? <p className="loadingState">Actualizando hojas de ruta…</p> : <RouteList items={visibleRoutes} full />}</section></section>;
}

function ProcurementModule({ openRouteModal }: { openRouteModal: () => void }) {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Procesos de contratación</h2><p>Desde la certificación presupuestaria hasta el pago</p></div><button className="primaryAction" onClick={openRouteModal}><span>＋</span>Nueva solicitud</button></div><div className="statGrid compactStats"><StatCard color="orange" label="En preparación" value="6" note="2 con observaciones" /><StatCard color="blue" label="En contratación" value="4" note="1 requiere aprobación" /><StatCard color="violet" label="Pendientes de pago" value="3" note="Bs 18.450 en total" /><StatCard color="green" label="Concluidos" value="19" note="Gestión 2026" /></div><section className="panel tablePanel"><div className="tableHeader"><span>Proceso</span><span>Objeto</span><span>Modalidad</span><span>Estado</span><span>Monto</span></div><ProcurementRow code="CM-2026-0038" object="Impresión de invitaciones" mode="Contratación Menor" status="Visto bueno" amount="Bs 4.850" /><ProcurementRow code="CM-2026-0034" object="Servicio de producción audiovisual" mode="Contratación Menor" status="Cotización" amount="Bs 12.000" /><ProcurementRow code="ANPE-2026-0007" object="Mantenimiento de alumbrado público" mode="ANPE" status="Adjudicado" amount="Bs 184.500" /></section></section>;
}

function ProcurementRow({ code, object, mode, status, amount }: { code: string; object: string; mode: string; status: string; amount: string }) {
  return <div className="tableRow"><strong>{code}</strong><span>{object}</span><span>{mode}</span><i className="status progress">{status}</i><b>{amount}</b></div>;
}

function AgendaModule({ today }: { today: Date | null }) {
  const dayOfWeek = today?.getUTCDay() ?? 1;
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const week = today ? Array.from({ length: 5 }, (_, index) => addMunicipalDays(today, mondayOffset + index)) : [];
  const selectedDate = today
    ? capitalizeDateLabel(formatMunicipalDate(today, { weekday: "long", day: "numeric", month: "long" }))
    : "Fecha actual";
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Agenda del alcalde</h2><p>Audiencias, reuniones, actos e inspecciones</p></div><button className="primaryAction"><span>＋</span>Agendar evento</button></div><div className="calendarStrip"><button aria-label="Semana anterior">‹</button>{week.map((date) => <div className={date.getUTCDate() === today?.getUTCDate() ? "active" : ""} key={date.toISOString()}><small>{formatMunicipalDate(date, { weekday: "short" }).replace(".", "").toUpperCase()}</small><b>{date.getUTCDate()}</b></div>)}<button aria-label="Semana siguiente">›</button></div><section className="panel dayAgenda"><h3>{selectedDate}</h3>{events.map((event) => <article className="dayEvent" key={event.time}><time>{event.time}</time><i className={event.color} /><div><strong>{event.title}</strong><span>{event.place}</span></div><span>Confirmado</span></article>)}</section></section>;
}

function TransparencyModule({ today }: { today: Date | null }) {
  const year = today?.getUTCFullYear() ?? getMunicipalYear();
  const dateLabel = today ? formatMunicipalDate(today, { day: "numeric", month: "long" }) : "fecha actual";
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Transparencia municipal</h2><p>Información pública preparada para la ciudadanía</p></div><button className="primaryAction">Publicar actualización</button></div><section className="transparencyHero"><div><span>EJECUCIÓN PRESUPUESTARIA {year}</span><strong>62,8%</strong><p>Información demostrativa pendiente de conexión con la fuente oficial.</p></div><div className="donut"><span>63<small>%</small></span></div></section><div className="statGrid"><StatCard color="blue" label="Presupuesto vigente" value="Bs 84,2 M" note={`Gestión ${year}`} /><StatCard color="green" label="Ejecutado" value="Bs 52,9 M" note={`Al ${dateLabel}`} /><StatCard color="orange" label="Proyectos activos" value="38" note="12 con avance público" /><StatCard color="violet" label="Procesos publicados" value="117" note="Sincronización pendiente" /></div></section>;
}

function RouteModal({ mode, close, succeed, createdCode }: { mode: "form" | "success"; close: () => void; succeed: (code: string) => void; createdCode: string }) {
  const access = useAccess();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/hojas-ruta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          remitente: form.get("remitente"),
          asunto: form.get("asunto"),
          descripcion: form.get("descripcion"),
          tipo: form.get("tipo"),
          prioridad: form.get("prioridad"),
          unidadCodigo: form.get("unidadCodigo"),
          documento: form.get("documento"),
          telefono: form.get("telefono"),
        }),
      });
      const data = (await response.json()) as { item?: { code: string }; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "No se pudo registrar la hoja de ruta.");
      succeed(data.item.code);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar la hoja de ruta.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>{mode === "success" ? <section className="routeModal successModal" role="dialog" aria-modal="true" aria-labelledby="success-title"><div className="successMark">✓</div><h2 id="success-title">Hoja de ruta registrada</h2><p>El registro fue creado correctamente con el código <strong>{createdCode}</strong> y derivado a la unidad seleccionada.</p><button className="primaryAction" onClick={close}>Volver al panel</button></section> : <form className="routeModal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="route-title"><header className="modalHeader"><div><span>NUEVO REGISTRO</span><h2 id="route-title">Crear hoja de ruta</h2></div><button type="button" onClick={close} aria-label="Cerrar">×</button></header><label>Remitente<input name="remitente" required maxLength={220} placeholder="Nombre de la persona o institución" /></label><div className="formGrid"><label>Documento<input name="documento" maxLength={80} placeholder="CI, NIT o referencia" /></label><label>Teléfono<input name="telefono" maxLength={40} placeholder="Número de contacto" /></label></div><label>Asunto<input name="asunto" required maxLength={300} placeholder="Resumen de la solicitud" /></label><label>Descripción<textarea name="descripcion" rows={3} placeholder="Describe brevemente la solicitud" /></label><div className="formGrid"><label>Tipo<select name="tipo" defaultValue="solicitud_externa"><option value="solicitud_externa">Solicitud externa</option><option value="comunicacion_interna">Comunicación interna</option><option value="solicitud_audiencia">Solicitud de audiencia</option></select></label><label>Prioridad<select name="prioridad" defaultValue="normal"><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label></div><label>Unidad de destino<select name="unidadCodigo" defaultValue="COM"><option value="COM">Unidad de Comunicación</option><option value="OBR">Obras Públicas</option><option value="CAT">Catastro</option><option value="DH">Desarrollo Humano</option><option value="DAP">Desarrollo Agropecuario</option></select></label>{error && <p className="formError" role="alert">{error}</p>}<div className="modalActions"><button type="button" onClick={close}>Cancelar</button><button className="primaryAction" type="submit" disabled={submitting}>{submitting ? "Registrando…" : "Registrar y derivar →"}</button></div></form>}</div>;
}
