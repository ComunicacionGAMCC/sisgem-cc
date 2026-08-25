"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatMunicipalDate } from "../lib/municipal-date";
import { useAccess } from "./access";
import { useMunicipalDate } from "./use-municipal-date";

type Specialty = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationMinutes: number;
};

type Availability = {
  id: string;
  specialtyId: string;
  specialtyCode: string;
  specialty: string;
  date: string;
  startTime: string;
  capacity: number;
  booked: number;
  available: number;
};

type Booking = {
  id: string;
  code: string;
  patientName: string;
  document: string;
  specialty: string;
  date: string;
  estimatedTime: string;
  turn: number;
  status: string;
  state: string;
};

type MedicalData = {
  hospital: string;
  summary: { total: number; hoy: number; pendientes: number; atendidas: number };
  specialties: Specialty[];
  availability: Availability[];
  bookings: Booking[];
  privacy: string;
};

type Confirmation = {
  code: string;
  specialty: string;
  date: string;
  estimatedTime: string;
  turn: number;
  status: string;
  hospital: string;
  instructions: string;
};

function formatDate(date: string, compact = false) {
  return formatMunicipalDate(date, compact
    ? { weekday: "short", day: "numeric", month: "short" }
    : { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

async function loadMedicalData(signal?: AbortSignal) {
  const response = await fetch("/api/fichas-medicas", { cache: "no-store", signal });
  const data = (await response.json()) as MedicalData & { error?: string };
  if (!response.ok) throw new Error(data.error || "No se pudo cargar la agenda médica.");
  return data;
}

export function MedicalBookingCard() {
  const municipalDate = useMunicipalDate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MedicalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [specialtyId, setSpecialtyId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestIdRef = useRef("");

  useEffect(() => {
    if (!open || data) return;
    const controller = new AbortController();
    loadMedicalData(controller.signal)
      .then((result) => {
        setData(result);
        setSpecialtyId(result.specialties[0]?.id ?? "");
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No se pudo cargar la agenda.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [data, open]);

  const dates = useMemo(
    () => data?.availability.filter((item) => item.specialtyId === specialtyId && item.available > 0).slice(0, 8) ?? [],
    [data, specialtyId],
  );

  function close() {
    setOpen(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!specialtyId || !slotId) {
      setError("Selecciona una especialidad y una fecha disponible.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/fichas-medicas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: requestIdRef.current || (requestIdRef.current = crypto.randomUUID()),
          especialidadId: specialtyId,
          cupoId: slotId,
          nombrePaciente: form.get("nombrePaciente"),
          documento: form.get("documento"),
          telefono: form.get("telefono"),
          fechaNacimiento: form.get("fechaNacimiento"),
          consentimiento: form.get("consentimiento") === "on",
        }),
      });
      const result = (await response.json()) as { item?: Confirmation; error?: string };
      if (!response.ok || !result.item) throw new Error(result.error || "No se pudo emitir la ficha.");
      setConfirmation(result.item);
      setData(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo emitir la ficha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <article className="priorityCard medicalCard" id="ficha-medica">
        <div className="priorityIcon" aria-hidden="true">✚</div>
        <div><span>HOSPITAL MUNICIPAL DE CUATRO CAÑADAS</span><h2>Saca tu ficha médica virtual aquí</h2><p>Elige la especialidad, revisa los cupos disponibles y recibe tu número de atención sin hacer fila.</p></div>
        <button onClick={() => { requestIdRef.current = crypto.randomUUID(); setConfirmation(null); setLoading(true); setOpen(true); }}>Solicitar ficha <span>→</span></button>
      </article>

      {open && (
        <div className="medicalBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section className="medicalModal" role="dialog" aria-modal="true" aria-labelledby="medical-title">
            <header className="medicalModalHeader">
              <div className="hospitalSeal">✚</div>
              <div><span>SALUD MUNICIPAL</span><h2 id="medical-title">{confirmation ? "Tu ficha está reservada" : "Ficha médica virtual"}</h2><p>Hospital Municipal de Cuatro Cañadas</p></div>
              <button className="medicalClose" onClick={close} aria-label="Cerrar">×</button>
            </header>

            {confirmation ? (
              <div className="medicalConfirmation">
                <div className="confirmationCheck">✓</div>
                <span>RESERVA CONFIRMADA</span>
                <strong className="medicalCode">{confirmation.code}</strong>
                <div className="confirmationGrid">
                  <div><small>Especialidad</small><strong>{confirmation.specialty}</strong></div>
                  <div><small>Fecha</small><strong>{formatDate(confirmation.date)}</strong></div>
                  <div><small>Turno</small><strong>N.º {confirmation.turn}</strong></div>
                  <div><small>Hora estimada</small><strong>{confirmation.estimatedTime}</strong></div>
                </div>
                <p className="medicalInstructions">{confirmation.instructions}</p>
                <button className="medicalPrimary" onClick={close}>Listo, guardaré mi código</button>
              </div>
            ) : (
              <form className="medicalForm" onSubmit={submit}>
                {loading && <div className="medicalLoading">Consultando cupos disponibles…</div>}
                {!loading && data && (
                  <>
                    <div className="medicalStep"><b>1</b><div><strong>Elige una especialidad</strong><small>Atención ambulatoria programada</small></div></div>
                    <div className="specialtyGrid">
                      {data.specialties.map((specialty) => (
                        <button type="button" key={specialty.id} className={specialtyId === specialty.id ? "selected" : ""} onClick={() => { setSpecialtyId(specialty.id); setSlotId(""); }}>
                          <span>✚</span><strong>{specialty.name}</strong><small>{specialty.description}</small>
                        </button>
                      ))}
                    </div>

                    <div className="medicalStep"><b>2</b><div><strong>Selecciona una fecha</strong><small>Los cupos se actualizan en tiempo real</small></div></div>
                    <div className="dateGrid">
                      {dates.map((slot) => (
                        <button type="button" key={slot.id} className={slotId === slot.id ? "selected" : ""} onClick={() => setSlotId(slot.id)}>
                          <strong>{formatDate(slot.date, true)}</strong><span>{slot.available} cupos</span>
                        </button>
                      ))}
                      {!dates.length && <p className="noMedicalSlots">No hay cupos próximos para esta especialidad.</p>}
                    </div>

                    <div className="medicalStep"><b>3</b><div><strong>Datos del paciente</strong><small>Se usarán únicamente para emitir y verificar la ficha</small></div></div>
                    <div className="patientGrid">
                      <label className="wide">Nombre completo<input name="nombrePaciente" required minLength={5} autoComplete="name" placeholder="Nombres y apellidos" /></label>
                      <label>Cédula de identidad<input name="documento" required minLength={4} autoComplete="off" placeholder="Número de CI" /></label>
                      <label>Teléfono<input name="telefono" required minLength={7} inputMode="tel" autoComplete="tel" placeholder="Ej.: 7XXXXXXX" /></label>
                      <label>Fecha de nacimiento <small>(opcional)</small><input name="fechaNacimiento" type="date" max={municipalDate ?? undefined} /></label>
                    </div>
                    <label className="medicalConsent"><input name="consentimiento" type="checkbox" required /><span>Autorizo el uso de estos datos únicamente para gestionar mi atención en el Hospital Municipal.</span></label>
                    <p className="medicalNotice"><b>Importante:</b> la ficha virtual no reemplaza emergencias. Si necesitas atención urgente, acude directamente al hospital.</p>
                  </>
                )}
                {error && <p className="medicalError" role="alert">{error}</p>}
                <footer className="medicalFormFooter"><button type="button" onClick={close}>Cancelar</button><button className="medicalPrimary" type="submit" disabled={loading || submitting || !slotId}>{submitting ? "Reservando…" : "Confirmar y obtener ficha"}</button></footer>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export function MedicalModule() {
  const access = useAccess();
  const [data, setData] = useState<MedicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("todas");

  useEffect(() => {
    const controller = new AbortController();
    loadMedicalData(controller.signal)
      .then(setData)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "No se pudo cargar el panel.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data?.bookings.filter((item) => {
      const matchesSpecialty = specialty === "todas" || item.specialty === specialty;
      const matchesQuery = !term || `${item.code} ${item.patientName} ${item.document}`.toLowerCase().includes(term);
      return matchesSpecialty && matchesQuery;
    }) ?? [];
  }, [data, query, specialty]);

  if (loading) return <section className="medicalModuleState">Cargando agenda del hospital…</section>;
  if (error || !data) return <section className="medicalModuleState error">{error || "La agenda no está disponible."}</section>;

  const nextDates = [...new Set(data.availability.map((item) => item.date))].slice(0, 5);
  return (
    <div className="medicalModule">
      <section className="hospitalHero">
        <div><span>HOSPITAL MUNICIPAL DE CUATRO CAÑADAS</span><h2>Panel de fichas médicas virtuales</h2><p>Control operativo de reservas, turnos y disponibilidad para atención ambulatoria.</p></div>
        <div className="hospitalHeroMark"><b>✚</b><span>Agenda activa<small>Próximos 15 días hábiles</small></span></div>
      </section>

      <section className="medicalStats" aria-label="Resumen de fichas médicas">
        <article><span>Fichas emitidas</span><strong>{data.summary.total}</strong><small>Acumulado registrado</small></article>
        <article><span>Atenciones de hoy</span><strong>{data.summary.hoy}</strong><small>Agenda del día</small></article>
        <article><span>Por atender</span><strong>{data.summary.pendientes}</strong><small>Reservadas o confirmadas</small></article>
        <article><span>Especialidades</span><strong>{data.specialties.length}</strong><small>Con agenda habilitada</small></article>
      </section>

      {access.hasPermission("health.patients.register") && <PatientRegistry />}

      <section className="panel medicalAgendaPanel">
        <header className="medicalPanelHeader"><div><span>DISPONIBILIDAD</span><h3>Agenda de los próximos días</h3></div><small>Los cupos se descuentan al emitir cada ficha</small></header>
        <div className="availabilityTable">
          <div className="availabilityHeader"><span>Especialidad</span>{nextDates.map((date) => <span key={date}>{formatDate(date, true)}</span>)}</div>
          {data.specialties.map((item) => (
            <div className="availabilityRow" key={item.id}>
              <strong>{item.name}<small>{item.durationMinutes} min. por turno</small></strong>
              {nextDates.map((date) => {
                const slot = data.availability.find((entry) => entry.specialtyId === item.id && entry.date === date);
                return <span key={date} className={!slot?.available ? "full" : ""}><b>{slot?.available ?? 0}</b><small>disponibles</small></span>;
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="panel medicalBookingsPanel">
        <header className="medicalPanelHeader"><div><span>FICHAS VIRTUALES</span><h3>Reservas registradas</h3></div><em>Datos protegidos</em></header>
        <div className="medicalFilters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código o documento protegido" aria-label="Buscar ficha médica" />
          <select value={specialty} onChange={(event) => setSpecialty(event.target.value)} aria-label="Filtrar por especialidad">
            <option value="todas">Todas las especialidades</option>
            {data.specialties.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
        </div>
        <div className="medicalTable">
          <div className="medicalTableHeader"><span>Ficha / paciente</span><span>Especialidad</span><span>Fecha y hora</span><span>Turno</span><span>Estado</span></div>
          {visible.map((item) => (
            <article key={item.id}>
              <span><strong>{item.code}</strong><small>{item.patientName} · CI {item.document}</small></span>
              <span>{item.specialty}</span>
              <span><strong>{formatDate(item.date, true)}</strong><small>{item.estimatedTime} estimada</small></span>
              <span className="turnBadge">N.º {item.turn}</span>
              <span className={`medicalStatus ${item.state}`}>{item.status}</span>
            </article>
          ))}
          {!visible.length && <p className="emptyMedicalTable">Aún no hay fichas que coincidan con esta búsqueda.</p>}
        </div>
        <p className="privacyBanner"><b>Privacidad activa.</b> {data.privacy}</p>
      </section>
    </div>
  );
}

type RegisteredPatient = {
  id: string;
  clinicalNumber: number;
  fullName: string;
  documentNumber: string;
  alreadyRegistered: boolean;
};

function PatientRegistry() {
  const access = useAccess();
  const municipalDate = useMunicipalDate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [patient, setPatient] = useState<RegisteredPatient | null>(null);

  async function registerPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("");
    setPatient(null);
    const { data, error } = await access.client.rpc("health_register_patient", {
      patient_document_type: form.get("documentType"),
      patient_document_number: form.get("documentNumber"),
      patient_full_name: form.get("fullName"),
      patient_birth_date: form.get("birthDate") || null,
      patient_sex: form.get("sex") || null,
      patient_phone: form.get("phone") || null,
      patient_address: form.get("address") || null,
      patient_emergency_contact: null,
    });
    setSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const result = data as unknown as RegisteredPatient;
    setPatient(result);
    setMessage(result.alreadyRegistered
      ? "El paciente ya estaba registrado; no se creó un duplicado."
      : "Paciente registrado correctamente en el Hospital Municipal.");
    if (!result.alreadyRegistered) event.currentTarget.reset();
  }

  return (
    <section className="panel patientRegistryPanel">
      <header className="medicalPanelHeader">
        <div><span>ADMISIÓN HOSPITALARIA</span><h3>Registro inicial de pacientes</h3></div>
        <button className="medicalPrimary" onClick={() => setOpen((value) => !value)}>{open ? "Cerrar formulario" : "+ Registrar paciente"}</button>
      </header>
      <div className="patientRegistryIntro"><b>Historia clínica única</b><p>Admisión o Secretaría registra al paciente una sola vez. El sistema detecta documentos duplicados y asigna automáticamente el número de historia clínica.</p></div>
      {open && <form className="patientRegistryForm" onSubmit={registerPatient}>
        <div className="patientRegistryGrid">
          <label>Tipo de documento<select name="documentType" defaultValue="CI"><option value="CI">Cédula de identidad</option><option value="CN">Certificado de nacimiento</option><option value="PASAPORTE">Pasaporte</option><option value="SIN_DOCUMENTO">Sin documento</option></select></label>
          <label>Número de documento<input name="documentNumber" required minLength={4} /></label>
          <label className="wide">Nombre completo<input name="fullName" required minLength={5} /></label>
          <label>Fecha de nacimiento<input name="birthDate" type="date" max={municipalDate ?? undefined} /></label>
          <label>Sexo<select name="sex" defaultValue=""><option value="">No especificado</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="OTRO">Otro</option></select></label>
          <label>Teléfono<input name="phone" inputMode="tel" /></label>
          <label className="wide">Dirección<input name="address" /></label>
        </div>
        {message && <p className={`patientRegistryMessage ${patient?.alreadyRegistered ? "existing" : ""}`}>{message}{patient && <span>Historia clínica N.º {patient.clinicalNumber} · {patient.fullName} · CI {patient.documentNumber}</span>}</p>}
        <footer><button type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="medicalPrimary" disabled={submitting}>{submitting ? "Registrando…" : "Crear historia clínica"}</button></footer>
      </form>}
    </section>
  );
}
