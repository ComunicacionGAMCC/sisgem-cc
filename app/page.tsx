"use client";

import { FormEvent, useState } from "react";

const services = [
  {
    number: "01",
    icon: "▤",
    title: "Trámites municipales",
    description: "Inicia solicitudes, adjunta documentos y sigue cada paso.",
  },
  {
    number: "02",
    icon: "Bs",
    title: "Impuestos y pagos",
    description: "Consulta obligaciones, pagos y comprobantes municipales.",
  },
  {
    number: "03",
    icon: "+",
    title: "Salud y fichas",
    description: "Solicita una ficha de atención y consulta tu turno.",
  },
  {
    number: "04",
    icon: "○",
    title: "Solicitar audiencia",
    description: "Pide una reunión y recibe la confirmación de Secretaría.",
  },
  {
    number: "05",
    icon: "!",
    title: "Denuncias",
    description: "Reporta posibles hechos de corrupción de forma protegida.",
  },
  {
    number: "06",
    icon: "↗",
    title: "Transparencia",
    description: "Revisa presupuesto, obras, contrataciones y resultados.",
  },
];

const steps = [
  ["1", "Presenta", "Completa la solicitud y adjunta los documentos necesarios."],
  ["2", "Sigue", "Recibe tu código y consulta cada avance en tiempo real."],
  ["3", "Recibe", "Obtén la respuesta y tus documentos desde el portal."],
];

export default function Home() {
  const [trackingCode, setTrackingCode] = useState("");
  const [resultCode, setResultCode] = useState("");
  const [notice, setNotice] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);

  function submitTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = trackingCode.trim().toUpperCase();
    if (!code) {
      setNotice("Ingresa el código de tu comprobante para realizar la consulta.");
      return;
    }
    setNotice("");
    setResultCode(code);
  }

  function startService(title: string) {
    setNotice(`${title}: el formulario digital estará disponible en la siguiente etapa.`);
    document.querySelector("#seguimiento")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="SISGEM-CC, inicio">
          <span className="brand-mark" aria-hidden="true">CC</span>
          <span>
            <strong>SISGEM-CC</strong>
            <small>Sistema de Gestión Municipal</small>
          </span>
        </a>

        <nav aria-label="Navegación principal">
          <a href="#servicios">Servicios</a>
          <a href="#seguimiento">Seguimiento</a>
          <a href="#como-funciona">Cómo funciona</a>
        </nav>

        <button className="staff-button" type="button" onClick={() => setStaffOpen(true)}>
          <span aria-hidden="true">◎</span> Acceso funcionarios
        </button>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow"><span /> MUNICIPIO DIGITAL</p>
          <h1>Tu municipio,<br /><em>más cerca.</em></h1>
          <p className="hero-description">
            Realiza trámites, solicita servicios y sigue tus gestiones desde cualquier lugar,
            sin filas y con información clara.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#servicios">Iniciar un trámite <span>→</span></a>
            <a className="secondary-button" href="#seguimiento">Consultar mi solicitud</a>
          </div>
          <div className="trust-row" aria-label="Beneficios del servicio">
            <span><b>✓</b> Seguro y transparente</span>
            <span><b>✓</b> Disponible las 24 horas</span>
          </div>
        </div>

        <div className="route-card" aria-label="Ejemplo de seguimiento de trámite">
          <div className="route-topline">
            <span><i /> Seguimiento en tiempo real</span>
            <span className="route-badge">HR</span>
          </div>
          <p className="route-label">HOJA DE RUTA</p>
          <div className="route-title">
            <strong>HR-2026-00481</strong>
            <span>En proceso</span>
          </div>
          <div className="timeline">
            <div className="timeline-item complete">
              <span className="timeline-dot">✓</span>
              <div><strong>Solicitud recibida</strong><small>Secretaría General · 08:42</small></div>
            </div>
            <div className="timeline-item complete">
              <span className="timeline-dot">✓</span>
              <div><strong>Derivada a Comunicación</strong><small>Recibida · 09:18</small></div>
            </div>
            <div className="timeline-item current">
              <span className="timeline-dot" />
              <div><strong>Trabajo en elaboración</strong><small>Actualizado hace 25 minutos</small></div>
            </div>
            <div className="timeline-item">
              <span className="timeline-dot" />
              <div><strong>Respuesta y cierre</strong><small>Fecha estimada: 6 de agosto</small></div>
            </div>
          </div>
          <div className="estimate"><span>Tiempo estimado</span><strong>2 días hábiles</strong></div>
        </div>
      </section>

      <section className="section services-section" id="servicios">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span /> SERVICIOS EN LÍNEA</p>
            <h2>¿Qué necesitas hacer?</h2>
          </div>
          <p>Elige un servicio para comenzar.<br />Te guiaremos paso a paso.</p>
        </div>
        <div className="services-grid">
          {services.map((service) => (
            <button className="service-card" key={service.number} type="button" onClick={() => startService(service.title)}>
              <span className="service-number">{service.number}</span>
              <span className="service-icon" aria-hidden="true">{service.icon}</span>
              <span className="card-arrow" aria-hidden="true">↗</span>
              <strong>{service.title}</strong>
              <span>{service.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="tracking-section" id="seguimiento">
        <div className="tracking-copy">
          <p className="eyebrow light"><span /> SEGUIMIENTO DE SOLICITUDES</p>
          <h2>¿Ya tienes un trámite?</h2>
          <p>Ingresa el código que aparece en tu comprobante para conocer su estado y la unidad responsable.</p>
        </div>
        <form className="tracking-form" onSubmit={submitTracking}>
          <label htmlFor="tracking-code">Código de seguimiento</label>
          <div className="tracking-input-row">
            <input
              id="tracking-code"
              value={trackingCode}
              onChange={(event) => setTrackingCode(event.target.value)}
              placeholder="Ej.: HR-2026-00481"
            />
            <button type="submit">Consultar <span>→</span></button>
          </div>
          <small>Para esta demostración puedes escribir cualquier código.</small>
        </form>
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}

      {resultCode && (
        <section className="result-panel" aria-live="polite">
          <div><span>Consulta</span><strong>{resultCode}</strong></div>
          <div><span>Estado actual</span><strong className="status-pill">En proceso</strong></div>
          <div><span>Unidad responsable</span><strong>Secretaría General</strong></div>
          <button type="button" onClick={() => setResultCode("")} aria-label="Cerrar resultado">×</button>
        </section>
      )}

      <section className="section process-section" id="como-funciona">
        <div className="process-intro">
          <p className="eyebrow"><span /> SIMPLE Y TRANSPARENTE</p>
          <h2>Tu solicitud<br />en tres pasos</h2>
        </div>
        <div className="steps">
          {steps.map(([number, title, description]) => (
            <article className="step" key={number}>
              <span>{number}</span>
              <div><strong>{title}</strong><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <span className="footer-seal" aria-hidden="true">CC</span>
          <div><strong>Gobierno Autónomo Municipal</strong><span>Cuatro Cañadas · Santa Cruz, Bolivia</span></div>
        </div>
        <p>Trabajo honesto, progreso nuestro.</p>
        <button type="button" onClick={() => setStaffOpen(true)}>Portal interno <span>→</span></button>
      </footer>

      {staffOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setStaffOpen(false)}>
          <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setStaffOpen(false)} aria-label="Cerrar">×</button>
            <span className="modal-icon" aria-hidden="true">◎</span>
            <p className="eyebrow"><span /> ÁREA INTERNA</p>
            <h2 id="staff-title">Acceso de funcionarios</h2>
            <p>El módulo interno de gestión y derivación de trámites se habilitará en la siguiente etapa del proyecto.</p>
            <button className="primary-button" type="button" onClick={() => setStaffOpen(false)}>Entendido</button>
          </section>
        </div>
      )}
    </main>
  );
}
