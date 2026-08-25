import { getHealthClient } from "./health-index";

export type NuevaFichaMedica = {
  solicitudId: string;
  especialidadId: string;
  cupoId: string;
  nombrePaciente: string;
  documento: string;
  telefono: string;
  fechaNacimiento?: string;
  consentimiento: boolean;
};

type EstadoFicha = "reservada" | "confirmada" | "atendida" | "ausente" | "cancelada";

type PanelRpc = {
  hospital: string;
  summary: { total: number; hoy: number; pendientes: number; atendidas: number };
  specialties: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    durationMinutes: number;
  }>;
  availability: Array<{
    id: string;
    specialtyId: string;
    specialtyCode: string;
    specialty: string;
    description: string | null;
    durationMinutes: number;
    date: string;
    startTime: string;
    capacity: number;
    booked: number;
    available: number;
  }>;
  bookings: Array<{
    id: string;
    code: string;
    patientName: string;
    document: string;
    specialty: string;
    date: string;
    estimatedTime: string;
    turn: number;
    state: EstadoFicha;
    createdAt: string;
  }>;
  privacy: string;
};

type FichaRpc = {
  id: string;
  code: string;
  specialty: string;
  date: string;
  estimatedTime: string;
  turn: number;
  status: string;
  hospital: string;
  instructions: string;
};

const estadoEtiquetas: Record<EstadoFicha, string> = {
  reservada: "Reservada",
  confirmada: "Confirmada",
  atendida: "Atendida",
  ausente: "Ausente",
  cancelada: "Cancelada",
};

function ocultarNombre(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => `${parte[0]?.toUpperCase() ?? ""}${"•".repeat(Math.min(Math.max(parte.length - 1, 1), 6))}`)
    .join(" ");
}

function ocultarDocumento(documento: string) {
  const limpio = documento.trim();
  return `${"•".repeat(Math.max(limpio.length - 3, 3))}${limpio.slice(-3)}`;
}

export async function obtenerPanelFichasMedicas() {
  const { data, error } = await getHealthClient().rpc("health_portal_panel");

  if (error) throw new Error(`No se pudo consultar la base de salud: ${error.message}`);
  const panel = data as unknown as PanelRpc;

  return {
    ...panel,
    bookings: panel.bookings.map((ficha) => ({
      ...ficha,
      patientName: ocultarNombre(ficha.patientName),
      document: ocultarDocumento(ficha.document),
      status: estadoEtiquetas[ficha.state] ?? "Reservada",
    })),
  };
}

export async function obtenerDisponibilidadPublica() {
  const panel = await obtenerPanelFichasMedicas();
  return {
    hospital: panel.hospital,
    specialties: panel.specialties,
    availability: panel.availability,
    privacy: "La consulta pública muestra únicamente especialidades y cupos disponibles.",
  };
}

export async function crearFichaMedica(input: NuevaFichaMedica) {
  const { data, error } = await getHealthClient().rpc("health_create_appointment", {
    p_request_id: input.solicitudId,
    p_specialty_id: input.especialidadId,
    p_slot_id: input.cupoId,
    p_patient_name: input.nombrePaciente,
    p_document_number: input.documento,
    p_phone: input.telefono,
    p_birth_date: input.fechaNacimiento || null,
    p_consent_granted: input.consentimiento,
  });

  if (error) throw new Error(error.message);
  return data as unknown as FichaRpc;
}
