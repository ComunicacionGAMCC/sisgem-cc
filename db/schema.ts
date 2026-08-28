import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
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

export const cargosOrganigrama = pgTable(
  "cargos_organigrama",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    codigo: varchar("codigo", { length: 30 }).notNull(),
    unidadId: uuid("unidad_id")
      .notNull()
      .references(() => unidades.id, { onDelete: "restrict" }),
    superiorCodigo: varchar("superior_codigo", { length: 30 }),
    nombre: varchar("nombre", { length: 240 }).notNull(),
    nivel: varchar("nivel", { length: 30 }).notNull(),
    gestion: integer("gestion").default(2025).notNull(),
    orden: integer("orden").default(0).notNull(),
    activo: boolean("activo").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("cargos_organigrama_codigo_uidx").on(table.codigo),
    index("cargos_organigrama_unidad_idx").on(table.unidadId, table.activo),
    index("cargos_organigrama_superior_idx").on(table.superiorCodigo),
    check(
      "cargos_organigrama_nivel_check",
      sql`${table.nivel} in ('ejecutivo', 'asesoria', 'apoyo', 'direccion', 'jefatura', 'profesional', 'tecnico', 'auxiliar', 'operativo')`,
    ),
  ],
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
    actorUsuarioId: uuid("actor_usuario_id"),
    actorNombre: varchar("actor_nombre", { length: 220 }),
    publico: boolean("publico").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("eventos_seguimiento_hoja_idx").on(table.hojaRutaId),
    index("eventos_seguimiento_fecha_idx").on(table.createdAt),
  ],
);

export const hojasRutaAdjuntos = pgTable(
  "hojas_ruta_adjuntos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    hojaRutaId: uuid("hoja_ruta_id")
      .notNull()
      .references(() => hojasDeRuta.id, { onDelete: "cascade" }),
    eventoId: uuid("evento_id").references(() => eventosSeguimiento.id, { onDelete: "set null" }),
    nombre: varchar("nombre", { length: 240 }).notNull(),
    tipoMime: varchar("tipo_mime", { length: 120 }).notNull(),
    tamanoBytes: integer("tamano_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    contenidoBase64: text("contenido_base64").notNull(),
    publico: boolean("publico").default(false).notNull(),
    subidoPorUsuarioId: uuid("subido_por_usuario_id"),
    subidoPorNombre: varchar("subido_por_nombre", { length: 220 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("hojas_ruta_adjuntos_hoja_fecha_idx").on(table.hojaRutaId, table.createdAt),
    index("hojas_ruta_adjuntos_evento_idx").on(table.eventoId),
    check("hojas_ruta_adjuntos_tamano_check", sql`${table.tamanoBytes} > 0 and ${table.tamanoBytes} <= 3145728`),
  ],
);

export const secuenciasCodigo = pgTable("secuencias_codigo", {
  gestion: integer("gestion").primaryKey(),
  ultimo: integer("ultimo").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agendaActividades = pgTable(
  "agenda_actividades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fecha: date("fecha").notNull(),
    horaInicio: time("hora_inicio", { withTimezone: false }).notNull(),
    horaFin: time("hora_fin", { withTimezone: false }),
    titulo: varchar("titulo", { length: 220 }).notNull(),
    lugar: varchar("lugar", { length: 220 }),
    descripcion: text("descripcion"),
    estado: varchar("estado", { length: 30 }).default("confirmada").notNull(),
    creadoPorUsuarioId: uuid("creado_por_usuario_id"),
    creadoPorNombre: varchar("creado_por_nombre", { length: 220 }),
    ...auditColumns,
  },
  (table) => [
    index("agenda_actividades_fecha_hora_idx").on(table.fecha, table.horaInicio),
    index("agenda_actividades_estado_idx").on(table.estado),
    check(
      "agenda_actividades_estado_check",
      sql`${table.estado} in ('confirmada', 'tentativa')`,
    ),
    check(
      "agenda_actividades_horas_check",
      sql`${table.horaFin} is null or ${table.horaFin} > ${table.horaInicio}`,
    ),
  ],
);

export const rrhhCargos = pgTable(
  "rrhh_cargos",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    codigo: varchar("codigo", { length: 40 }).notNull(),
    unidadId: uuid("unidad_id").notNull().references(() => unidades.id, { onDelete: "restrict" }),
    cargoOrganigramaId: integer("cargo_organigrama_id").references(() => cargosOrganigrama.id, { onDelete: "set null" }),
    nombre: varchar("nombre", { length: 240 }).notNull(),
    tipoVinculacion: varchar("tipo_vinculacion", { length: 30 }).notNull(),
    haberBasico: numeric("haber_basico", { precision: 14, scale: 2 }).default("0").notNull(),
    activo: boolean("activo").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("rrhh_cargos_codigo_uidx").on(table.codigo),
    index("rrhh_cargos_unidad_activo_idx").on(table.unidadId, table.activo),
    check("rrhh_cargos_tipo_check", sql`${table.tipoVinculacion} in ('planta', 'consultor_linea', 'contrato')`),
    check("rrhh_cargos_haber_check", sql`${table.haberBasico} >= 0`),
  ],
);

export const rrhhPersonal = pgTable(
  "rrhh_personal",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    documento: varchar("documento", { length: 40 }).notNull(),
    nombres: varchar("nombres", { length: 120 }).notNull(),
    apellidos: varchar("apellidos", { length: 160 }).notNull(),
    cargoId: integer("cargo_id").notNull().references(() => rrhhCargos.id, { onDelete: "restrict" }),
    tipoVinculacion: varchar("tipo_vinculacion", { length: 30 }).notNull(),
    fechaIngreso: date("fecha_ingreso").notNull(),
    fechaFinContrato: date("fecha_fin_contrato"),
    email: varchar("email", { length: 240 }),
    telefono: varchar("telefono", { length: 40 }),
    activo: boolean("activo").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("rrhh_personal_documento_uidx").on(table.documento),
    index("rrhh_personal_cargo_activo_idx").on(table.cargoId, table.activo),
    check("rrhh_personal_tipo_check", sql`${table.tipoVinculacion} in ('planta', 'consultor_linea', 'contrato')`),
  ],
);

export const rrhhMovimientosCargo = pgTable(
  "rrhh_movimientos_cargo",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    personalId: integer("personal_id").notNull().references(() => rrhhPersonal.id, { onDelete: "cascade" }),
    cargoAnteriorId: integer("cargo_anterior_id").references(() => rrhhCargos.id, { onDelete: "set null" }),
    cargoNuevoId: integer("cargo_nuevo_id").notNull().references(() => rrhhCargos.id, { onDelete: "restrict" }),
    motivo: varchar("motivo", { length: 500 }).notNull(),
    fechaEfectiva: date("fecha_efectiva").notNull(),
    registradoPorUsuarioId: uuid("registrado_por_usuario_id"),
    registradoPorNombre: varchar("registrado_por_nombre", { length: 220 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("rrhh_movimientos_personal_fecha_idx").on(table.personalId, table.fechaEfectiva)],
);

export const rrhhPlanillas = pgTable(
  "rrhh_planillas",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    gestion: integer("gestion").notNull(),
    mes: integer("mes").notNull(),
    estado: varchar("estado", { length: 20 }).default("borrador").notNull(),
    totalGanado: numeric("total_ganado", { precision: 16, scale: 2 }).default("0").notNull(),
    totalDescuentos: numeric("total_descuentos", { precision: 16, scale: 2 }).default("0").notNull(),
    totalLiquido: numeric("total_liquido", { precision: 16, scale: 2 }).default("0").notNull(),
    creadoPorUsuarioId: uuid("creado_por_usuario_id"),
    creadoPorNombre: varchar("creado_por_nombre", { length: 220 }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("rrhh_planillas_periodo_uidx").on(table.gestion, table.mes),
    check("rrhh_planillas_mes_check", sql`${table.mes} between 1 and 12`),
    check("rrhh_planillas_estado_check", sql`${table.estado} in ('borrador', 'revisada', 'cerrada')`),
  ],
);

export const rrhhPlanillaItems = pgTable(
  "rrhh_planilla_items",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    planillaId: integer("planilla_id").notNull().references(() => rrhhPlanillas.id, { onDelete: "cascade" }),
    personalId: integer("personal_id").notNull().references(() => rrhhPersonal.id, { onDelete: "restrict" }),
    haberBasico: numeric("haber_basico", { precision: 14, scale: 2 }).notNull(),
    bonos: numeric("bonos", { precision: 14, scale: 2 }).default("0").notNull(),
    totalGanado: numeric("total_ganado", { precision: 14, scale: 2 }).notNull(),
    totalDescuentos: numeric("total_descuentos", { precision: 14, scale: 2 }).default("0").notNull(),
    liquidoPagable: numeric("liquido_pagable", { precision: 14, scale: 2 }).notNull(),
    observaciones: text("observaciones"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("rrhh_planilla_items_personal_uidx").on(table.planillaId, table.personalId),
    index("rrhh_planilla_items_personal_idx").on(table.personalId),
  ],
);

export const rrhhDescuentos = pgTable(
  "rrhh_descuentos",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    planillaItemId: integer("planilla_item_id").notNull().references(() => rrhhPlanillaItems.id, { onDelete: "cascade" }),
    concepto: varchar("concepto", { length: 180 }).notNull(),
    tipo: varchar("tipo", { length: 30 }).default("otro").notNull(),
    monto: numeric("monto", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("rrhh_descuentos_item_idx").on(table.planillaItemId),
    check("rrhh_descuentos_tipo_check", sql`${table.tipo} in ('afp', 'rc_iva', 'anticipo', 'falta', 'otro')`),
    check("rrhh_descuentos_monto_check", sql`${table.monto} > 0`),
  ],
);

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
