import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  time,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const health = pgSchema("health");

export const estadoFichaMedicaSalud = health.enum("appointment_status", [
  "reservada",
  "confirmada",
  "atendida",
  "ausente",
  "cancelada",
]);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const centrosSalud = health.table("facilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  codigo: varchar("code", { length: 24 }).notNull(),
  nombre: varchar("name", { length: 180 }).notNull(),
  municipio: varchar("municipality", { length: 120 }).default("Cuatro Cañadas").notNull(),
  departamento: varchar("department", { length: 120 }).default("Santa Cruz").notNull(),
  activo: boolean("active").default(true).notNull(),
  ...auditColumns,
});

export const especialidadesMedicasSalud = health.table(
  "specialties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    centroSaludId: uuid("facility_id").notNull().references(() => centrosSalud.id, { onDelete: "restrict" }),
    codigo: varchar("code", { length: 24 }).notNull(),
    nombre: varchar("name", { length: 140 }).notNull(),
    descripcion: text("description"),
    duracionMinutos: integer("duration_minutes").default(15).notNull(),
    cupoDiarioDefault: integer("default_daily_capacity").default(20).notNull(),
    orden: integer("display_order").default(0).notNull(),
    activa: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("specialties_facility_code_uidx").on(table.centroSaludId, table.codigo),
    index("specialties_facility_order_idx").on(table.centroSaludId, table.orden),
    check("specialties_duration_valid", sql`${table.duracionMinutos} between 5 and 120`),
    check("specialties_capacity_valid", sql`${table.cupoDiarioDefault} between 1 and 300`),
  ],
);
export const cuposMedicosSalud = health.table(
  "appointment_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    especialidadId: uuid("specialty_id").notNull().references(() => especialidadesMedicasSalud.id, { onDelete: "restrict" }),
    fecha: date("appointment_date").notNull(),
    horaInicio: time("start_time", { precision: 0 }).default("07:00:00").notNull(),
    cupoTotal: integer("total_capacity").notNull(),
    cuposReservados: integer("reserved_count").default(0).notNull(),
    activo: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("appointment_slots_specialty_date_uidx").on(table.especialidadId, table.fecha),
    index("appointment_slots_date_active_idx").on(table.fecha, table.activo),
    check("appointment_slots_total_valid", sql`${table.cupoTotal} between 1 and 300`),
    check("appointment_slots_reserved_valid", sql`${table.cuposReservados} between 0 and ${table.cupoTotal}`),
  ],
);

export const fichasMedicasSalud = health.table(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    solicitudId: varchar("request_id", { length: 64 }).notNull(),
    codigo: varchar("code", { length: 40 }).notNull(),
    centroSaludId: uuid("facility_id").notNull().references(() => centrosSalud.id, { onDelete: "restrict" }),
    especialidadId: uuid("specialty_id").notNull().references(() => especialidadesMedicasSalud.id, { onDelete: "restrict" }),
    cupoId: uuid("slot_id").notNull().references(() => cuposMedicosSalud.id, { onDelete: "restrict" }),
    nombrePaciente: varchar("patient_name", { length: 220 }).notNull(),
    documento: varchar("document_number", { length: 40 }).notNull(),
    telefono: varchar("phone", { length: 40 }).notNull(),
    fechaNacimiento: date("birth_date"),
    fechaAtencion: date("appointment_date").notNull(),
    horaEstimada: time("estimated_time", { precision: 0 }).notNull(),
    numeroTurno: integer("turn_number").notNull(),
    estado: estadoFichaMedicaSalud("status").default("reservada").notNull(),
    consentimiento: boolean("consent_granted").notNull(),
    consentimientoAt: timestamp("consented_at", { withTimezone: true }).defaultNow().notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("appointments_request_uidx").on(table.solicitudId),
    uniqueIndex("appointments_code_uidx").on(table.codigo),
    uniqueIndex("appointments_slot_turn_uidx").on(table.cupoId, table.numeroTurno),
    index("appointments_date_status_idx").on(table.fechaAtencion, table.estado),
    index("appointments_specialty_date_idx").on(table.especialidadId, table.fechaAtencion),
    index("appointments_document_idx").on(table.centroSaludId, table.documento),
    check("appointments_turn_positive", sql`${table.numeroTurno} > 0`),
  ],
);
