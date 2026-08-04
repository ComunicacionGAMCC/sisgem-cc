"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type InternalTab = "inicio" | "hojas" | "contrataciones" | "agenda" | "transparencia";

const services = [
  { key: "TR", icon: "01", title: "Trámites municipales", text: "Inicia solicitudes, adjunta documentos y sigue cada paso.", tone: "green" },
  { key: "IP", icon: "02", title: "Impuestos y pagos", text: "Consulta obligaciones, pagos y comprobantes municipales.", tone: "orange" },
  { key: "SA", icon: "03", title: "Salud y fichas", text: "Solicita una ficha de atención y consulta tu turno.", tone: "blue" },
  { key: "AU", icon: "04", title: "Solicitar audiencia", text: "Pide una reunión y recibe la confirmación de Secretaría.", tone: "violet" },
  { key: "DE", icon: "05", title: "Denuncias", text: "Reporta posibles hechos de corrupción de forma protegida.", tone: "pink" },
  { key: "TE", icon: "06", title: "Transparencia", text: "Revisa presupuesto, obras, contrataciones y resultados.", tone: "navy" },
];

const inboxItems = [
  { id: "HR-2026-00481", origin: "U.E. Nacional Cuatro Cañadas", subject: "Solicitud de spot para feria educativa", unit: "Comunicación", time: "Vence hoy", status: "Urgente", statusClass: "danger" },
  { id: "HR-2026-00477", origin: "OTB 15 de Agosto", subject: "Solicitud de mantenimiento de alumbrado", unit: "Obras Públicas", time: "2 días restantes", status: "En proceso", statusClass: "progress" },
  { id: "HR-2026-00469", origin: "Asociación de productores", subject: "Solicitud de apoyo técnico productivo", unit: "Desarrollo Agropecuario", time: "3 días restantes", status: "Recibido", statusClass: "received" },
  { id: "HR-2026-00454", origin: "María Elena Vargas", subject: "Certificación de datos catastrales", unit: "Catastro", time: "Respondido hoy", status: "Finalizado", statusClass: "done" },
];

const procurementSteps = [
  { label: "Necesidad registrada", detail: "Unidad de Comunicación", done: true },
  { label: "Certificación presupuestaria", detail: "CP-2026-0184 aprobada", done: true },
  { label: "Inicio de contratación", detail: "Pendiente de visto bueno", done: false },
  { label: "Orden de servicio", detail: "Aún no iniciada", done: false },
];

const agenda = [
  { time: "08:30", title: "Reunión con directores", meta: "Sala de Gabinete", color: "green" },
  { time: "10:00", title: "Audiencia — Central 4 Este", meta: "Despacho del Alcalde", color: "blue" },
  { time: "14:30", title: "Inspección avance de obra", meta: "Unidad Educativa San Antonio", color: "orange" },
];

export default function Home() {
  const [mode, setMode] = useState<"citizen" | "internal">("citizen");
  const [tab, setTab] = useState<InternalTab>("inicio");
  const [query, setQuery] = useState("");
  const [trackingVisible, setTrackingVisible] = useState(false);
  const [routeModal, setRouteModal] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const today = useMemo(
    () => new Intl.DateTimeFormat("es-BO", { weekday: "long", day: "numeric", month: "long" }).format(new Date()),
    [],
  );

  function track(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      setNotice("Escribe un código de seguimiento para continuar.");
      return;
    }
    setNotice("");
    setTrackingVisible(true);
  }

  if (mode === "internal") {
    return (
      <div className="internalShell">
        <aside className="sidebar">
          <button className="brandButton" onClick={() => setMode("citizen")} aria-label="Volver al portal ciudadano">
            <img src="/marca-cuatro-canadas.png" alt="Cuatro Cañadas" />
          </button>
          <div className="sideLabel">GESTIÓN MUNICIPAL</div>
          <nav className="sideNav" aria-label="Navegación interna">
            <SideButton active={tab === "inicio"} label="Inicio" icon="⌂" onClick={() => setTab("inicio")} />
            <SideButton active={tab === "hojas"} label="Hojas de ruta" icon="↗" badge="12" onClick={() => setTab("hojas")} />
            <SideButton active={tab === "contrataciones"} label="Contrataciones" icon="▣" onClick={() => setTab("contrataciones")} />
            <SideButton active={tab === "agenda"} label="Agenda" icon="□" onClick={() => setTab("agenda")} />
            <SideButton active={tab === "transparencia"} label="Transparencia" icon="◎" onClick={() => setTab("transparencia")} />
          </nav>
          <div className="sidebarFooter">
            <div className="avatar small">SC</div>
            <div><strong>Saúl Cabrera</strong><span>Unidad de Comunicación</span></div>
            <button title="Opciones de cuenta" aria-label="Opciones de cuenta">•••</button>
          </div>
        </aside>

        <main className="internalMain">
          <header className="internalHeader">
            <div>
              <span className="sectionKicker">MUNICIPIO DIGITAL</span>
              <h1>{tabTitle(tab)}</h1>
            </div>
            <div className="headerActions">
              <span className="demoPill"><i /> Prototipo · datos de prueba</span>
              <button className="iconButton" title="Notificaciones" aria-label="Notificaciones">●<span className="notificationDot" /></button>
              <button className="portalLink" onClick={() => setMode("citizen")}>Ver portal ciudadano</button>
            </div>
          </header>

          {tab === "inicio" && (
            <>
              <section className="welcomeRow">
                <div>
                  <p className="dateLine">{today}</p>
                  <h2>Buenos días, Saúl.</h2>
                  <p>Tienes <strong>3 asuntos prioritarios</strong> que requieren atención.</p>
                </div>
                <button className="primaryAction" onClick={() => setRouteModal(true)}><span>＋</span>Nueva hoja de ruta</button>
              </section>

              <section className="statGrid" aria-label="Resumen del trabajo">
                <StatCard label="En mi bandeja" value="12" detail="3 nuevas hoy" tone="blue" />
                <StatCard label="Por vencer" value="3" detail="Requieren atención" tone="orange" />
                <StatCard label="Finalizadas este mes" value="28" detail="+12% respecto a julio" tone="green" />
                <StatCard label="Tiempo promedio" value="2,4 d" detail="Meta institucional: 5 días" tone="violet" />
              </section>

              <section className="dashboardGrid">
                <div className="panel inboxPanel">
                  <div className="panelHeader">
                    <div><span className="panelEyebrow">HOJA DE RUTA</span><h3>Requieren tu atención</h3></div>
                    <button onClick={() => setTab("hojas")}>Ver toda la bandeja →</button>
                  </div>
                  <div className="inboxList">
                    {inboxItems.slice(0, 3).map((item) => <InboxRow key={item.id} item={item} />)}
                  </div>
                </div>

                <div className="panel agendaPanel">
                  <div className="panelHeader compact">
                    <div><span className="panelEyebrow">AGENDA DEL ALCALDE</span><h3>Hoy, 4 de agosto</h3></div>
                    <button className="squareButton" onClick={() => setTab("agenda")} aria-label="Abrir agenda">↗</button>
                  </div>
                  <div className="agendaList">
                    {agenda.map((event) => (
                      <div className="agendaItem" key={event.time}>
                        <time>{event.time}</time><span className={`agendaMark ${event.color}`} />
                        <div><strong>{event.title}</strong><span>{event.meta}</span></div>
                      </div>
                    ))}
                  </div>
                  <button className="subtleAction">＋ Agendar audiencia</button>
                </div>
              </section>

              <section className="panel procurementPanel">
                <div className="panelHeader">
                  <div><span className="panelEyebrow">CONTRATACIÓN EN CURSO</span><h3>Servicio de impresión — Invitaciones aniversario municipal</h3></div>
                  <div className="processCode">CM-2026-0038</div>
                </div>
                <div className="stepTrack">
                  {procurementSteps.map((step, index) => (
                    <div className={`processStep ${step.done ? "complete" : ""}`} key={step.label}>
                      <div className="stepTop"><span>{step.done ? "✓" : index + 1}</span><i /></div>
                      <strong>{step.label}</strong><small>{step.detail}</small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "hojas" && <ListView title="Bandeja de hojas de ruta" subtitle="Solicitudes recibidas y derivadas a tu unidad" action="Nueva hoja de ruta" onAction={() => setRouteModal(true)} />}
          {tab === "contrataciones" && <ProcurementView />}
          {tab === "agenda" && <AgendaView />}
          {tab === "transparencia" && <TransparencyView />}
        </main>

        {routeModal && <RouteModal onClose={() => setRouteModal(false)} />}
      </div>
    );
  }

  return (
    <div className="citizenSite">
      <div className="topRibbon">Gobierno Autónomo Municipal de Cuatro Cañadas <span>•</span> Capital Soyera de Bolivia</div>
      <header className="citizenHeader">
        <a className="citizenBrand" href="#inicio" aria-label="Inicio Municipio Digital">
          <img src="/marca-cuatro-canadas.png" alt="Cuatro Cañadas, Capital Soyera de Bolivia" />
          <span><strong>Municipio Digital</strong><small>Al servicio de nuestra gente</small></span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#servicios">Servicios</a><a href="#seguimiento">Seguimiento</a><a href="#como-funciona">Cómo funciona</a>
        </nav>
        <button className="employeeAccess" onClick={() => setMode("internal")}><span>◎</span> Acceso funcionarios</button>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="heroGlow one" /><div className="heroGlow two" />
          <div className="heroContent">
            <span className="heroKicker"><i /> MUNICIPIO DIGITAL</span>
            <h1>Tu municipio,<br /><em>más cerca.</em></h1>
            <p>Realiza trámites, solicita servicios y sigue tus gestiones desde cualquier lugar, sin filas y con información clara.</p>
            <div className="heroButtons">
              <button className="heroPrimary" onClick={() => document.getElementById("servicios")?.scrollIntoView({ behavior: "smooth" })}>Iniciar un trámite <span>→</span></button>
              <button className="heroSecondary" onClick={() => document.getElementById("seguimiento")?.scrollIntoView({ behavior: "smooth" })}>Consultar mi solicitud</button>
            </div>
            <div className="trustLine"><span>✓</span> Seguro y transparente <span>✓</span> Disponible las 24 horas</div>
          </div>

          <div className="heroCard" aria-label="Ejemplo de seguimiento de trámite">
            <div className="heroCardTop"><span>Seguimiento en tiempo real</span><i /></div>
            <div className="caseHeader"><div className="caseIcon">HR</div><div><small>HOJA DE RUTA</small><strong>HR-2026-00481</strong></div><span className="liveBadge">En proceso</span></div>
            <div className="miniTimeline">
              <TimelineItem done title="Solicitud recibida" meta="Secretaría General · 08:42" />
              <TimelineItem done title="Derivada a Comunicación" meta="Recibida · 09:18" />
              <TimelineItem active title="Trabajo en elaboración" meta="Actualizado hace 25 minutos" />
              <TimelineItem title="Respuesta y cierre" meta="Fecha estimada: 6 de agosto" />
            </div>
            <div className="heroCardFooter"><span>Tiempo estimado</span><strong>2 días hábiles</strong></div>
          </div>
        </section>

        <section className="serviceSection" id="servicios">
          <div className="sectionHeading"><span>SERVICIOS EN LÍNEA</span><h2>¿Qué necesitas hacer?</h2><p>Elige un servicio para comenzar. Te guiaremos paso a paso.</p></div>
          <div className="serviceGrid">
            {services.map((service) => (
              <button className="serviceCard" key={service.key} onClick={() => setNotice(`${service.title}: este servicio se habilitará en la siguiente etapa.`)}>
                <div className={`serviceIcon ${service.tone}`}>{service.icon}</div>
                <span className="serviceArrow">↗</span>
                <h3>{service.title}</h3><p>{service.text}</p>
              </button>
            ))}
          </div>
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}
        </section>

        <section className="trackingSection" id="seguimiento">
          <div className="trackingCopy"><span>SEGUIMIENTO DE SOLICITUDES</span><h2>¿Ya tienes un trámite?</h2><p>Ingresa el código que aparece en tu comprobante para conocer su estado y la unidad responsable.</p></div>
          <form className="trackingForm" onSubmit={track}>
            <label htmlFor="tracking">Código de seguimiento</label>
            <div><input id="tracking" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej.: HR-2026-00481" /><button type="submit">Consultar <span>→</span></button></div>
            <small>Para esta demostración puedes escribir cualquier código.</small>
          </form>
        </section>

        {trackingVisible && (
          <section className="trackingResult" aria-live="polite">
            <div><span className="resultCheck">✓</span><div><small>SOLICITUD ENCONTRADA</small><h3>{query.toUpperCase()}</h3><p>Solicitud de material audiovisual — Unidad de Comunicación</p></div></div>
            <span className="liveBadge">En proceso</span>
          </section>
        )}

        <section className="howSection" id="como-funciona">
          <div className="sectionHeading"><span>SIMPLE Y TRANSPARENTE</span><h2>Tu solicitud en tres pasos</h2></div>
          <div className="howGrid">
            <div><b>1</b><h3>Presenta</h3><p>Completa la solicitud y adjunta los documentos necesarios.</p></div>
            <div><b>2</b><h3>Sigue</h3><p>Recibe tu código y consulta cada avance en tiempo real.</p></div>
            <div><b>3</b><h3>Recibe</h3><p>Obtén la respuesta y tus documentos desde el portal.</p></div>
          </div>
        </section>
      </main>

      <footer className="citizenFooter">
        <div><img src="/escudo-gamcc.png" alt="Escudo del Gobierno Autónomo Municipal de Cuatro Cañadas" /><span><strong>Gobierno Autónomo Municipal</strong><small>Cuatro Cañadas · Santa Cruz, Bolivia</small></span></div>
        <p>Trabajo honesto, progreso nuestro.</p>
        <button onClick={() => setMode("internal")}>Portal interno →</button>
      </footer>
    </div>
  );
}

function SideButton({ active, label, icon, badge, onClick }: { active: boolean; label: string; icon: string; badge?: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span className="navIcon">{icon}</span><span>{label}</span>{badge && <b>{badge}</b>}</button>;
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <div className={`statCard ${tone}`}><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><i /></div>;
}

function InboxRow({ item }: { item: (typeof inboxItems)[number] }) {
  return <div className="inboxRow"><div className="docGlyph">▤</div><div className="inboxIdentity"><strong>{item.subject}</strong><span>{item.origin} · <b>{item.id}</b></span></div><span className="unitPill">{item.unit}</span><div className="inboxStatus"><span className={item.statusClass}>{item.status}</span><small>{item.time}</small></div><button aria-label={`Abrir ${item.id}`}>›</button></div>;
}

function TimelineItem({ done, active, title, meta }: { done?: boolean; active?: boolean; title: string; meta: string }) {
  return <div className={`timelineItem ${done ? "done" : ""} ${active ? "active" : ""}`}><div className="timelineDot">{done ? "✓" : ""}</div><div><strong>{title}</strong><span>{meta}</span></div></div>;
}

function tabTitle(tab: InternalTab) {
  return ({ inicio: "Panel de gestión", hojas: "Hojas de ruta", contrataciones: "Contrataciones", agenda: "Agenda institucional", transparencia: "Transparencia" })[tab];
}

function ListView({ title, subtitle, action, onAction }: { title: string; subtitle: string; action: string; onAction: () => void }) {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="primaryAction" onClick={onAction}>＋ {action}</button></div><div className="filterBar"><input placeholder="Buscar por código, asunto o remitente" /><button className="selected">Todos 12</button><button>Pendientes 7</button><button>Finalizados 5</button></div><div className="panel"><div className="inboxList full">{inboxItems.map((item) => <InboxRow key={item.id} item={item} />)}</div></div></section>;
}

function ProcurementView() {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Procesos de contratación</h2><p>Desde la certificación presupuestaria hasta el pago</p></div><button className="primaryAction">＋ Nueva solicitud</button></div><div className="statGrid compactStats"><StatCard label="En preparación" value="6" detail="2 con observaciones" tone="blue" /><StatCard label="En contratación" value="4" detail="1 requiere aprobación" tone="orange" /><StatCard label="Pendientes de pago" value="3" detail="Bs 18.450 en total" tone="violet" /><StatCard label="Concluidos" value="19" detail="Gestión 2026" tone="green" /></div><div className="panel tablePanel"><div className="tableHeader"><span>Proceso</span><span>Objeto</span><span>Modalidad</span><span>Estado</span><span>Monto</span></div><div className="tableRow"><strong>CM-2026-0038</strong><span>Impresión de invitaciones</span><span>Contratación Menor</span><i className="status progress">Visto bueno</i><b>Bs 4.850</b></div><div className="tableRow"><strong>CM-2026-0034</strong><span>Servicio de producción audiovisual</span><span>Contratación Menor</span><i className="status received">Cotización</i><b>Bs 12.000</b></div><div className="tableRow"><strong>ANPE-2026-0007</strong><span>Mantenimiento de alumbrado público</span><span>ANPE</span><i className="status done">Adjudicado</i><b>Bs 184.500</b></div></div></section>;
}

function AgendaView() {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Agenda del alcalde</h2><p>Audiencias, reuniones, actos e inspecciones</p></div><button className="primaryAction">＋ Agendar evento</button></div><div className="calendarStrip"><button>‹</button><div><small>LUN</small><b>3</b></div><div className="active"><small>MAR</small><b>4</b></div><div><small>MIÉ</small><b>5</b></div><div><small>JUE</small><b>6</b></div><div><small>VIE</small><b>7</b></div><button>›</button></div><div className="panel dayAgenda"><h3>Martes, 4 de agosto</h3>{agenda.map((event) => <div className="dayEvent" key={event.time}><time>{event.time}</time><i className={event.color} /><div><strong>{event.title}</strong><span>{event.meta}</span></div><span>Confirmado</span></div>)}</div></section>;
}

function TransparencyView() {
  return <section className="moduleView"><div className="moduleTitle"><div><h2>Transparencia municipal</h2><p>Información pública preparada para la ciudadanía</p></div><button className="primaryAction">Publicar actualización</button></div><div className="transparencyHero"><div><span>EJECUCIÓN PRESUPUESTARIA 2026</span><strong>62,8%</strong><p>Información demostrativa pendiente de conexión con la fuente oficial.</p></div><div className="donut"><span>63<small>%</small></span></div></div><div className="statGrid compactStats"><StatCard label="Presupuesto vigente" value="Bs 84,2 M" detail="Gestión 2026" tone="blue" /><StatCard label="Ejecutado" value="Bs 52,9 M" detail="Al 4 de agosto" tone="green" /><StatCard label="Proyectos activos" value="38" detail="12 con avance público" tone="orange" /><StatCard label="Procesos publicados" value="117" detail="Sincronización pendiente" tone="violet" /></div></section>;
}

function RouteModal({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  if (saved) return <div className="modalBackdrop"><div className="routeModal successModal"><div className="successMark">✓</div><h2>Hoja de ruta creada</h2><p>Se generó el código <strong>HR-2026-00482</strong> y quedó registrada en Secretaría General.</p><button className="primaryAction" onClick={onClose}>Volver a la bandeja</button></div></div>;
  return <div className="modalBackdrop" role="presentation" onMouseDown={onClose}><form className="routeModal" onSubmit={(e) => { e.preventDefault(); setSaved(true); }} onMouseDown={(e) => e.stopPropagation()}><div className="modalHeader"><div><span>NUEVO REGISTRO</span><h2>Crear hoja de ruta</h2></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></div><label>Remitente<input required placeholder="Nombre de la persona o institución" /></label><label>Asunto<textarea required placeholder="Describe brevemente la solicitud" rows={3} /></label><div className="formGrid"><label>Tipo<select><option>Solicitud externa</option><option>Comunicación interna</option><option>Solicitud de audiencia</option></select></label><label>Unidad de destino<select><option>Unidad de Comunicación</option><option>Obras Públicas</option><option>Catastro</option><option>Desarrollo Humano</option></select></label></div><label className="uploadField"><span>＋</span><strong>Adjuntar nota o documento</strong><small>PDF, JPG o PNG · Datos de demostración</small><input type="file" /></label><div className="modalActions"><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primaryAction">Registrar y derivar →</button></div></form></div>;
}
