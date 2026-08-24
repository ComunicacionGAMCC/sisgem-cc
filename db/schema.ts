import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  time,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const tipoSolicitante = pgEnum("tipo_solicitante", [
  "persona",
  "institucion",
  "unidad_interna",
]);

export const prioridadHoja = pgEnum("prioridad_hoja", [
  "baja",
  "normal",
  "alta",
  "urgente",
]);

export const estadoHoja = pgEnum("estado_hoja", [
  "recibido",
  "derivado",
  "en_proceso",
  "observado",
  "finalizado",
  "archivado",
]);

export const estadoDerivacion = pgEnum("estado_derivacion", [
  "pendiente",
  "recibida",
  "atendida",
]);

export const estadoFichaMedica = pgEnum("estado_ficha_medica", [
  "reservada",
  "confirmada",
  "atendida",
  "ausente",
  "cancelada",
]);

export const unidades = pgTable(
  "unidades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codigo: varchar("codigo", { length: 20 }).notNull(),
    nombre: varchar("nombre", { length: 180 }).notNull(),
    descripcion: text("descripcion"),
    activa: boolean("activa").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("unidades_codigo_uidx").on(table.codigo)],
);

export const funcionarios = pgTable(
  "funcionarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    unidadId: uuid("unidad_id")
      .notNull()
      .references(() => unidades.id, { onDelete: "restrict" }),
    nombres: varchar("nombres", { length: 120 }).notNull(),
    apellidos: varchar("apellidos", { length: 160 }).notNull(),
    cargo: varchar("cargo", { length: 180 }).notNull(),
    email: varchar("email", { length: 240 }),
    telefono: varchar("telefono", { length: 40 }),
    activo: boolean("activo").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("funcionarios_email_uidx").on(table.email),
    index("funcionarios_unidad_idx").on(table.unidadId),
  ],
);

export const solicitantes = pgTable(
  "solicitantes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tipo: tipoSolicitante("tipo").default("persona").notNull(),
    nombre: varchar("nombre", { length: 220 }).notNull(),
    documento: varchar("documento", { length: 80 }),
    organizacion: varchar("organizacion", { length: 220 }),
    email: varchar("email", { length: 240 }),
    telefono: varchar("telefono", { length: 40 }),
    direccion: text("direccion"),
    ...auditColumns,
  },
  (table) => [uniqueIndex("solicitantes_documento_uidx").on(table.documento)],
);

export const hojasDeRuta = pgTable(
  "hojas_de_ruta",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codigo: varchar("codigo", { length: 24 }).notNull(),
    tipo: varchar("tipo", { length: 80 }).default("solicitud_externa").notNull(),
    asunto: varchar("asunto", { length: 300 }).notNull(),
    descripcion: text("descripcion"),
    prioridad: prioridadHoja("prioridad").default("normal").notNull(),
    estado: estadoHoja("estado").default("recibido").notNull(),
    solicitanteId: uuid("solicitante_id")
      .notNull()
      .references(() => solicitantes.id, { onDelete: "restrict" }),
    unidadActualId: uuid("unidad_actual_id")
      .notNull()
      .references(() => unidades.id, { onDelete: "restrict" }),
    creadoPorId: uuid("creado_por_id").references(() => funcionarios.id, {
      onDelete: "set null",
    }),
    fechaLimite: timestamp("fecha_limite", { withTimezone: true }),
    finalizadoAt: timestamp("finalizado_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("hojas_de_ruta_codigo_uidx").on(table.codigo),
    index("hojas_de_ruta_estado_idx").on(table.estado),
    index("hojas_de_ruta_unidad_idx").on(table.unidadActualId),
    index("hojas_de_ruta_created_idx").on(table.createdAt),
  ],
);

export const derivaciones = pgTable(
  "derivaciones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    hojaRutaId: uuid("hoja_ruta_id")
      .notNull()
      .references(() => hojasDeRuta.id, { onDelete: "cascade" }),
    unidadOrigenId: uuid("unidad_origen_id").references(() => unidades.id, {
      onDelete: "set null",
    }),
    unidadDestinoId: uuid("unidad_destino_id")
      .notNull()
      .references(() => unidades.id, { onDelete: "restrict" }),
    derivadoPorId: uuid("derivado_por_id").references(() => funcionarios.id, {
      onDelete: "set null",
    }),
    recibidoPorId: uuid("recibido_por_id").references(() => funcionarios.id, {
      onDelete: "set null",
    }),
    estado: estadoDerivacion("estado").default("pendiente").notNull(),
    nota: text("nota"),
    derivadoAt: timestamp("derivado_at", { withTimezone: true }).defaultNow().notNull(),
    recibidoAt: timestamp("recibido_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("derivaciones_hoja_idx").on(table.hojaRutaId)],
);

export const eventosSeguimiento = pgTable(
  "eventos_seguimiento",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    hojaRutaId: uuid("hoja_ruta_id")
      .notNull()
      .references(() => hojasDeRuta.id, { onDelete: "cascade" }),
    estado: estadoHoja("estado").notNull(),
    titulo: varchar("titulo", { length: 220 }).notNull(),
    descripcion: text("descripcion"),
    unidadId: uuid("unidad_id").references(() => unidades.id, { onDelete: "set null" }),
    funcionarioId: uuid("funcionario_id").references(() => funcionarios.id, {
      onDelete: "set null",
    }),
    publico: boolean("publico").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("eventos_seguimiento_hoja_idx").on(table.hojaRutaId),
    index("eventos_seguimiento_fecha_idx").on(table.createdAt),
  ],
);

export const secuenciasCodigo = pgTable("secuencias_codigo", {
  gestion: integer("gestion").primaryKey(),
  ultimo: integer("ultimo").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entidad: varchar("entidad", { length: 80 }).notNull(),
    entidadId: uuid("entidad_id").notNull(),
    accion: varchar("accion", { length: 80 }).notNull(),
    funcionarioId: uuid("funcionario_id").references(() => funcionarios.id, {
      onDelete: "set null",
    }),
    detalle: jsonb("detalle").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("auditoria_entidad_idx").on(table.entidad, table.entidadId)],
);

export const especialidadesMedicas = pgTable(
  "especialidades_medicas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codigo: varchar("codigo", { length: 24 }).notNull(),
    nombre: varchar("nombre", { length: 140 }).notNull(),
    descripcion: text("descripcion"),
    duracionMinutos: integer("duracion_minutos").default(15).notNull(),
    cupoDiarioDefault: integer("cupo_diario_default").default(20).notNull(),
    orden: integer("orden").default(0).notNull(),
    activa: boolean("activa").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("especialidades_medicas_codigo_uidx").on(table.codigo),
    index("especialidades_medicas_activas_idx").on(table.activa, table.orden),
    check("especialidades_duracion_positiva", sql`${table.duracionMinutos} between 5 and 120`),
    check("especialidades_cupo_positivo", sql`${table.cupoDiarioDefault} between 1 and 300`),
  ],
);

export const cuposMedicos = pgTable(
  "cupos_medicos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    especialidadId: uuid("especialidad_id")
      .notNull()
      .references(() => especialidadesMedicas.id, { onDelete: "restrict" }),
    fecha: date("fecha").notNull(),
    horaInicio: time("hora_inicio", { precision: 0 }).default("07:00:00").notNull(),
    cupoTotal: integer("cupo_total").notNull(),
    cuposReservados: integer("cupos_reservados").default(0).notNull(),
    activo: boolean("activo").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("cupos_medicos_especialidad_fecha_uidx").on(table.especialidadId, table.fecha),
    index("cupos_medicos_fecha_activo_idx").on(table.fecha, table.activo),
    index("cupos_medicos_especialidad_idx").on(table.especialidadId),
    check("cupos_medicos_total_positivo", sql`${table.cupoTotal} between 1 and 300`),
    check("cupos_medicos_reservados_validos", sql`${table.cuposReservados} between 0 and ${table.cupoTotal}`),
  ],
);

export const fichasMedicas = pgTable(
  "fichas_medicas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    solicitudId: varchar("solicitud_id", { length: 64 }).notNull(),
    codigo: varchar("codigo", { length: 40 }).notNull(),
    especialidadId: uuid("especialidad_id")
      .notNull()
      .references(() => especialidadesMedicas.id, { onDelete: "restrict" }),
    cupoId: uuid("cupo_id")
      .notNull()
      .references(() => cuposMedicos.id, { onDelete: "restrict" }),
    nombrePaciente: varchar("nombre_paciente", { length: 220 }).notNull(),
    documento: varchar("documento", { length: 40 }).notNull(),
    telefono: varchar("telefono", { length: 40 }).notNull(),
    fechaNacimiento: date("fecha_nacimiento"),
    fechaAtencion: date("fecha_atencion").notNull(),
    horaEstimada: time("hora_estimada", { precision: 0 }).notNull(),
    numeroTurno: integer("numero_turno").notNull(),
    estado: estadoFichaMedica("estado").default("reservada").notNull(),
    consentimiento: boolean("consentimiento").default(false).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("fichas_medicas_solicitud_uidx").on(table.solicitudId),
    uniqueIndex("fichas_medicas_codigo_uidx").on(table.codigo),
    uniqueIndex("fichas_medicas_cupo_turno_uidx").on(table.cupoId, table.numeroTurno),
    index("fichas_medicas_fecha_estado_idx").on(table.fechaAtencion, table.estado),
    index("fichas_medicas_especialidad_fecha_idx").on(table.especialidadId, table.fechaAtencion),
    index("fichas_medicas_documento_idx").on(table.documento),
    index("fichas_medicas_cupo_idx").on(table.cupoId),
    check("fichas_medicas_turno_positivo", sql`${table.numeroTurno} > 0`),
  ],
);
