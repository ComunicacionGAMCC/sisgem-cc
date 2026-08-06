"use client";

import { FormEvent, useMemo, useState } from "react";

type InternalView = "inicio" | "hojas" | "contrataciones" | "agenda" | "transparencia";

const services = [
  { number: "01", title: "Trámites municipales", description: "Inicia solicitudes, adjunta documentos y sigue cada paso.", color: "green" },
  { number: "02", title: "Impuestos y pagos", description: "Consulta obligaciones, pagos y comprobantes municipales.", color: "orange" },
  { number: "03", title: "Salud y fichas", description: "Solicita una ficha de atención y consulta tu turno.", color: "blue" },
  { number: "04", title: "Solicitar audiencia", description: "Pide una reunión y recibe la confirmación de Secretaría.", color: "violet" },
  { number: "05", title: "Denuncias", description: "Reporta posibles hechos de corrupción de forma protegida.", color: "pink" },
  { number: "06", title: "Transparencia", description: "Revisa presupuesto, obras, contrataciones y resultados.", color: "navy" },
] as const;

const routes = [
  { code: "HR-2026-00481", title: "Solicitud de spot para feria educativa", sender: "U.E. Nacional Cuatro Cañadas", unit: "Comunicación", status: "Urgente", due: "Vence hoy", tone: "danger" },
  { code: "HR-2026-00477", title: "Solicitud de mantenimiento de alumbrado", sender: "OTB 15 de Agosto", unit: "Obras Públicas", status: "En proceso", due: "2 días restantes", tone: "progress" },
  { code: "HR-2026-00469", title: "Solicitud de apoyo técnico productivo", sender: "Asociación de productores", unit: "Desarrollo Agropecuario", status: "Recibido", due: "3 días restantes", tone: "received" },
  { code: "HR-2026-00454", title: "Certificación de datos catastrales", sender: "María Elena Vargas", unit: "Catastro", status: "Finalizado", due: "Respondido hoy", tone: "done" },
] as const;

type RouteItem = (typeof routes)[number];

const events = [
  { time: "08:30", title: "Reunión con directores", place: "Sala de Gabinete", color: "green" },
  { time: "10:00", title: "Audiencia — Central 4 Este", place: "Despacho del Alcalde", color: "blue" },
  { time: "14:30", title: "Inspección avance de obra", place: "Unidad Educativa San Antonio", color: "orange" },
] as const;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Home() {
  const [portal, setPortal] = useState<"citizen" | "internal">("citizen");
  const [internalView, setInternalView] = useState<InternalView>("inicio");
  const [notice, setNotice] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingResult, setTrackingResult] = useState("");
  const [routeModal, setRouteModal] = useState<"form" | "success" | null>(null);
  const [routeFilter, setRouteFilter] = useState<"todos" | "pendientes" | "finalizados">("todos");
  const [routeSearch, setRouteSearch] = useState("");

  const visibleRoutes = useMemo(() => {
    const query = routeSearch.trim().toLowerCase();
    return routes.filter((route) => {
      const matchesFilter = routeFilter === "todos" || (routeFilter === "finalizados" ? route.status === "Finalizado" : route.status !== "Finalizado");
      const matchesSearch = !query || `${route.code} ${route.title} ${route.sender}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [routeFilter, routeSearch]);

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

  function submitTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = trackingCode.trim() || "HR-2026-00481";
    setTrackingCode(code);
    setTrackingResult(code.toUpperCase());
  }

  if (portal === "internal") {
    return (
      <InternalPortal
        view={internalView}
        setView={setInternalView}
        openCitizen={openCitizenPortal}
        openRouteModal={() => setRouteModal("form")}
        filter={routeFilter}
        setFilter={setRouteFilter}
        search={routeSearch}
        setSearch={setRouteSearch}
        visibleRoutes={visibleRoutes}
        routeModal={routeModal}
        setRouteModal={setRouteModal}
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
          <a href="#servicios">Servicios</a>
          <a href="#seguimiento">Seguimiento</a>
          <a href="#como-funciona">Cómo funciona</a>
        </nav>
        <button className="employeeAccess" onClick={() => openInternal()}><span>◎</span> Acceso funcionarios</button>
      </header>

      <main>
        <section className="hero" id="inicio">
          <i className="heroGlow one" /><i className="heroGlow two" />
          <div className="heroContent">
            <div className="heroKicker"><i /> MUNICIPIO DIGITAL</div>
            <h1>Tu municipio,<br /><em>más cerca.</em></h1>
            <p>Realiza trámites, solicita servicios y sigue tus gestiones desde cualquier lugar, sin filas y con información clara.</p>
            <div className="heroButtons">
              <button className="heroPrimary" onClick={() => scrollToSection("servicios")}>Iniciar un trámite <span>→</span></button>
              <button className="heroSecondary" onClick={() => scrollToSection("seguimiento")}>Consultar mi solicitud</button>
            </div>
            <div className="trustLine"><span>✓</span> Seguro y transparente <span>✓</span> Disponible las 24 horas</div>
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
              <TimelineItem title="Respuesta y cierre" detail="Fecha estimada: 6 de agosto" />
            </div>
            <div className="heroCardFooter"><span>Tiempo estimado</span><strong>2 días hábiles</strong></div>
          </article>
        </section>

        <section className="serviceSection" id="servicios">
          <div className="sectionHeading"><span>SERVICIOS EN LÍNEA</span><h2>¿Qué necesitas hacer?</h2><p>Elige un servicio para comenzar. Te guiaremos paso a paso.</p></div>
          <div className="serviceGrid">
            {services.map((service) => (
              <button className="serviceCard" key={service.number} onClick={() => showServiceNotice(service.title)}>
                <span className={`serviceIcon ${service.color}`}>{service.number}</span><span className="serviceArrow">↗</span>
                <h3>{service.title}</h3><p>{service.description}</p>
              </button>
            ))}
          </div>
        </section>

        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}

        <section className="trackingSection" id="seguimiento">
          <div className="trackingCopy"><span>SEGUIMIENTO DE SOLICITUDES</span><h2>¿Ya tienes un trámite?</h2><p>Ingresa el código que aparece en tu comprobante para conocer su estado y la unidad responsable.</p></div>
          <form className="trackingForm" onSubmit={submitTracking}>
            <label htmlFor="tracking-code">Código de seguimiento</label>
            <div><input id="tracking-code" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="Ej.: HR-2026-00481" /><button type="submit">Consultar <span>→</span></button></div>
            <small>Para esta demostración puedes escribir cualquier código.</small>
          </form>
        </section>

        {trackingResult && (
          <section className="trackingResult" aria-live="polite"><div><span className="resultCheck">✓</span><span><small>SOLICITUD ENCONTRADA</small><h3>{trackingResult}</h3><p>Solicitud de material audiovisual — Unidad de Comunicación</p></span></div><span className="liveBadge">En proceso</span></section>
        )}

        <section className="howSection" id="como-funciona">
          <div className="sectionHeading"><span>SIMPLE Y TRANSPARENTE</span><h2>Tu solicitud en tres pasos</h2></div>
          <div className="howGrid"><HowStep number="1" title="Presenta" text="Completa la solicitud y adjunta los documentos necesarios." /><HowStep number="2" title="Sigue" text="Recibe tu código y consulta cada avance en tiempo real." /><HowStep number="3" title="Recibe" text="Obtén la respuesta y tus documentos desde el portal." /></div>
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

function InternalPortal({ view, setView, openCitizen, openRouteModal, filter, setFilter, search, setSearch, visibleRoutes, routeModal, setRouteModal }: {
  view: InternalView;
  setView: (view: InternalView) => void;
  openCitizen: () => void;
  openRouteModal: () => void;
  filter: "todos" | "pendientes" | "finalizados";
  setFilter: (filter: "todos" | "pendientes" | "finalizados") => void;
  search: string;
  setSearch: (value: string) => void;
  visibleRoutes: readonly RouteItem[];
  routeModal: "form" | "success" | null;
  setRouteModal: (value: "form" | "success" | null) => void;
}) {
  const titles: Record<InternalView, string> = { inicio: "Panel de gestión", hojas: "Hojas de ruta", contrataciones: "Contrataciones", agenda: "Agenda institucional", transparencia: "Transparencia" };
  return (
    <div className="internalShell">
      <aside className="sidebar">
        <button className="brandButton" onClick={openCitizen} aria-label="Volver al portal ciudadano"><img src="/marca-cuatro-canadas.png" alt="Cuatro Cañadas" /></button>
        <div className="sideLabel">GESTIÓN MUNICIPAL</div>
        <nav className="sideNav" aria-label="Navegación interna">
          <SideButton active={view === "inicio"} icon="⌂" label="Inicio" onClick={() => setView("inicio")} />
          <SideButton active={view === "hojas"} icon="↗" label="Hojas de ruta" badge="12" onClick={() => setView("hojas")} />
          <SideButton active={view === "contrataciones"} icon="▣" label="Contrataciones" onClick={() => setView("contrataciones")} />
          <SideButton active={view === "agenda"} icon="□" label="Agenda" onClick={() => setView("agenda")} />
          <SideButton active={view === "transparencia"} icon="◎" label="Transparencia" onClick={() => setView("transparencia")} />
        </nav>
        <div className="sidebarFooter"><span className="avatar small">SC</span><div><strong>Saúl Cabrera</strong><span>Unidad de Comunicación</span></div><button aria-label="Opciones de cuenta">•••</button></div>
      </aside>

      <main className="internalMain">
        <header className="internalHeader"><div><span className="sectionKicker">MUNICIPIO DIGITAL</span><h1>{titles[view]}</h1></div><div className="headerActions"><span className="demoPill"><i /> Prototipo · datos de prueba</span><button className="iconButton" aria-label="Notificaciones">●<span className="notificationDot" /></button><button className="portalLink" onClick={openCitizen}>Ver portal ciudadano</button></div></header>
        {view === "inicio" && <Dashboard setView={setView} openRouteModal={openRouteModal} />}
        {view === "hojas" && <RoutesModule openRouteModal={openRouteModal} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} visibleRoutes={visibleRoutes} />}
        {view === "contrataciones" && <ProcurementModule openRouteModal={openRouteModal} />}
        {view === "agenda" && <AgendaModule />}
        {view === "transparencia" && <TransparencyModule />}
      </main>
      {routeModal && <RouteModal mode={routeModal} close={() => setRouteModal(null)} succeed={() => setRouteModal("success")} />}
    </div>
  );
}

function SideButton({ active, icon, label, badge, onClick }: { active: boolean; icon: string; label: string; badge?: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span className="navIcon">{icon}</span><span>{label}</span>{badge && <b>{badge}</b>}</button>;
}

function Dashboard({ setView, openRouteModal }: { setView: (view: InternalView) => void; openRouteModal: () => void }) {
  return <>
    <section className="welcomeRow"><div><p className="dateLine">jueves, 6 de agosto</p><h2>Buenos días, Saúl.</h2><p>Tienes <strong>3 asuntos prioritarios</strong> que requieren atención.</p></div><button className="primaryAction" onClick={openRouteModal}><span>＋</span>Nueva hoja de ruta</button></section>
    <section className="statGrid" aria-label="Resumen del trabajo"><StatCard color="blue" label="En mi bandeja" value="12" note="3 nuevas hoy" /><StatCard color="orange" label="Por vencer" value="3" note="Requieren atención" /><StatCard color="green" label="Finalizadas este mes" value="28" note="+12% respecto a julio" /><StatCard color="violet" label="Tiempo promedio" value="2,4 d" note="Meta institucional: 5 días" /></section>
    <div className="dashboardGrid"><section className="panel"><PanelHeader eyebrow="HOJA DE RUTA" title="Requieren tu atención" action="Ver toda la bandeja →" onClick={() => setView("hojas")} /><RouteList items={routes.slice(0, 3)} /></section><section className="panel agendaPanel"><PanelHeader eyebrow="AGENDA DEL ALCALDE" title="Hoy, 4 de agosto" action="↗" onClick={() => setView("agenda")} /><AgendaList /><button className="subtleAction" onClick={() => setView("agenda")}>＋ Agendar audiencia</button></section></div>
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

function RoutesModule({ openRouteModal, filter, setFilter, search, setSearch, visibleRoutes }: { openRouteModal: () => void; filter: "todos" | "pendientes" | "finalizados"; setFilter: (value: "todos" | "pendientes" | "finalizados") => void; search: string; setSearch: (value: string) => void; visibleRoutes: readonly RouteItem[] }) {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Bandeja de hojas de ruta</h2><p>Solicitudes recibidas y derivadas a tu unidad</p></div><button className="primaryAction" onClick={openRouteModal}><span>＋</span>Nueva hoja de ruta</button></div><div className="filterBar"><input aria-label="Buscar por código, asunto o remitente" placeholder="Buscar por código, asunto o remitente" value={search} onChange={(event) => setSearch(event.target.value)} /><button className={filter === "todos" ? "selected" : ""} onClick={() => setFilter("todos")}>Todos 12</button><button className={filter === "pendientes" ? "selected" : ""} onClick={() => setFilter("pendientes")}>Pendientes 7</button><button className={filter === "finalizados" ? "selected" : ""} onClick={() => setFilter("finalizados")}>Finalizados 5</button></div><section className="panel"><RouteList items={visibleRoutes} full /></section></section>;
}

function ProcurementModule({ openRouteModal }: { openRouteModal: () => void }) {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Procesos de contratación</h2><p>Desde la certificación presupuestaria hasta el pago</p></div><button className="primaryAction" onClick={openRouteModal}><span>＋</span>Nueva solicitud</button></div><div className="statGrid compactStats"><StatCard color="orange" label="En preparación" value="6" note="2 con observaciones" /><StatCard color="blue" label="En contratación" value="4" note="1 requiere aprobación" /><StatCard color="violet" label="Pendientes de pago" value="3" note="Bs 18.450 en total" /><StatCard color="green" label="Concluidos" value="19" note="Gestión 2026" /></div><section className="panel tablePanel"><div className="tableHeader"><span>Proceso</span><span>Objeto</span><span>Modalidad</span><span>Estado</span><span>Monto</span></div><ProcurementRow code="CM-2026-0038" object="Impresión de invitaciones" mode="Contratación Menor" status="Visto bueno" amount="Bs 4.850" /><ProcurementRow code="CM-2026-0034" object="Servicio de producción audiovisual" mode="Contratación Menor" status="Cotización" amount="Bs 12.000" /><ProcurementRow code="ANPE-2026-0007" object="Mantenimiento de alumbrado público" mode="ANPE" status="Adjudicado" amount="Bs 184.500" /></section></section>;
}

function ProcurementRow({ code, object, mode, status, amount }: { code: string; object: string; mode: string; status: string; amount: string }) {
  return <div className="tableRow"><strong>{code}</strong><span>{object}</span><span>{mode}</span><i className="status progress">{status}</i><b>{amount}</b></div>;
}

function AgendaModule() {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Agenda del alcalde</h2><p>Audiencias, reuniones, actos e inspecciones</p></div><button className="primaryAction"><span>＋</span>Agendar evento</button></div><div className="calendarStrip"><button aria-label="Semana anterior">‹</button>{[["LUN", "3"], ["MAR", "4"], ["MIÉ", "5"], ["JUE", "6"], ["VIE", "7"]].map(([day, number]) => <div className={day === "MAR" ? "active" : ""} key={day}><small>{day}</small><b>{number}</b></div>)}<button aria-label="Semana siguiente">›</button></div><section className="panel dayAgenda"><h3>Martes, 4 de agosto</h3>{events.map((event) => <article className="dayEvent" key={event.time}><time>{event.time}</time><i className={event.color} /><div><strong>{event.title}</strong><span>{event.place}</span></div><span>Confirmado</span></article>)}</section></section>;
}

function TransparencyModule() {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Transparencia municipal</h2><p>Información pública preparada para la ciudadanía</p></div><button className="primaryAction">Publicar actualización</button></div><section className="transparencyHero"><div><span>EJECUCIÓN PRESUPUESTARIA 2026</span><strong>62,8%</strong><p>Información demostrativa pendiente de conexión con la fuente oficial.</p></div><div className="donut"><span>63<small>%</small></span></div></section><div className="statGrid"><StatCard color="blue" label="Presupuesto vigente" value="Bs 84,2 M" note="Gestión 2026" /><StatCard color="green" label="Ejecutado" value="Bs 52,9 M" note="Al 4 de agosto" /><StatCard color="orange" label="Proyectos activos" value="38" note="12 con avance público" /><StatCard color="violet" label="Procesos publicados" value="117" note="Sincronización pendiente" /></div></section>;
}

function RouteModal({ mode, close, succeed }: { mode: "form" | "success"; close: () => void; succeed: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); succeed(); }
  return <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>{mode === "success" ? <section className="routeModal successModal" role="dialog" aria-modal="true" aria-labelledby="success-title"><div className="successMark">✓</div><h2 id="success-title">Hoja de ruta registrada</h2><p>El registro fue creado correctamente con el código <strong>HR-2026-00482</strong> y derivado a la unidad seleccionada.</p><button className="primaryAction" onClick={close}>Volver al panel</button></section> : <form className="routeModal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="route-title"><header className="modalHeader"><div><span>NUEVO REGISTRO</span><h2 id="route-title">Crear hoja de ruta</h2></div><button type="button" onClick={close} aria-label="Cerrar">×</button></header><label>Remitente<input required placeholder="Nombre de la persona o institución" /></label><label>Asunto<textarea required rows={3} placeholder="Describe brevemente la solicitud" /></label><div className="formGrid"><label>Tipo<select><option>Solicitud externa</option><option>Comunicación interna</option><option>Solicitud de audiencia</option></select></label><label>Unidad de destino<select><option>Unidad de Comunicación</option><option>Obras Públicas</option><option>Catastro</option><option>Desarrollo Humano</option></select></label></div><label className="uploadField"><span>＋</span><strong>Adjuntar nota o documento</strong><small>PDF, JPG o PNG · Datos de demostración</small><input type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label="Adjuntar nota o documento" /></label><div className="modalActions"><button type="button" onClick={close}>Cancelar</button><button className="primaryAction" type="submit">Registrar y derivar →</button></div></form>}</div>;
}
