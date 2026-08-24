CREATE TYPE "public"."estado_ficha_medica" AS ENUM('reservada', 'confirmada', 'atendida', 'ausente', 'cancelada');--> statement-breakpoint
CREATE TABLE "cupos_medicos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"especialidad_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"hora_inicio" time(0) DEFAULT '07:00:00' NOT NULL,
	"cupo_total" integer NOT NULL,
	"cupos_reservados" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cupos_medicos_total_positivo" CHECK ("cupos_medicos"."cupo_total" between 1 and 300),
	CONSTRAINT "cupos_medicos_reservados_validos" CHECK ("cupos_medicos"."cupos_reservados" between 0 and "cupos_medicos"."cupo_total")
);
--> statement-breakpoint
CREATE TABLE "especialidades_medicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(24) NOT NULL,
	"nombre" varchar(140) NOT NULL,
	"descripcion" text,
	"duracion_minutos" integer DEFAULT 15 NOT NULL,
	"cupo_diario_default" integer DEFAULT 20 NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "especialidades_duracion_positiva" CHECK ("especialidades_medicas"."duracion_minutos" between 5 and 120),
	CONSTRAINT "especialidades_cupo_positivo" CHECK ("especialidades_medicas"."cupo_diario_default" between 1 and 300)
);
--> statement-breakpoint
CREATE TABLE "fichas_medicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" varchar(64) NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"especialidad_id" uuid NOT NULL,
	"cupo_id" uuid NOT NULL,
	"nombre_paciente" varchar(220) NOT NULL,
	"documento" varchar(40) NOT NULL,
	"telefono" varchar(40) NOT NULL,
	"fecha_nacimiento" date,
	"fecha_atencion" date NOT NULL,
	"hora_estimada" time(0) NOT NULL,
	"numero_turno" integer NOT NULL,
	"estado" "estado_ficha_medica" DEFAULT 'reservada' NOT NULL,
	"consentimiento" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fichas_medicas_turno_positivo" CHECK ("fichas_medicas"."numero_turno" > 0)
);
--> statement-breakpoint
ALTER TABLE "cupos_medicos" ADD CONSTRAINT "cupos_medicos_especialidad_id_especialidades_medicas_id_fk" FOREIGN KEY ("especialidad_id") REFERENCES "public"."especialidades_medicas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_medicas" ADD CONSTRAINT "fichas_medicas_especialidad_id_especialidades_medicas_id_fk" FOREIGN KEY ("especialidad_id") REFERENCES "public"."especialidades_medicas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_medicas" ADD CONSTRAINT "fichas_medicas_cupo_id_cupos_medicos_id_fk" FOREIGN KEY ("cupo_id") REFERENCES "public"."cupos_medicos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cupos_medicos_especialidad_fecha_uidx" ON "cupos_medicos" USING btree ("especialidad_id","fecha");--> statement-breakpoint
CREATE INDEX "cupos_medicos_fecha_activo_idx" ON "cupos_medicos" USING btree ("fecha","activo");--> statement-breakpoint
CREATE INDEX "cupos_medicos_especialidad_idx" ON "cupos_medicos" USING btree ("especialidad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "especialidades_medicas_codigo_uidx" ON "especialidades_medicas" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "especialidades_medicas_activas_idx" ON "especialidades_medicas" USING btree ("activa","orden");--> statement-breakpoint
CREATE UNIQUE INDEX "fichas_medicas_solicitud_uidx" ON "fichas_medicas" USING btree ("solicitud_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fichas_medicas_codigo_uidx" ON "fichas_medicas" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "fichas_medicas_cupo_turno_uidx" ON "fichas_medicas" USING btree ("cupo_id","numero_turno");--> statement-breakpoint
CREATE INDEX "fichas_medicas_fecha_estado_idx" ON "fichas_medicas" USING btree ("fecha_atencion","estado");--> statement-breakpoint
CREATE INDEX "fichas_medicas_especialidad_fecha_idx" ON "fichas_medicas" USING btree ("especialidad_id","fecha_atencion");--> statement-breakpoint
CREATE INDEX "fichas_medicas_documento_idx" ON "fichas_medicas" USING btree ("documento");--> statement-breakpoint
CREATE INDEX "fichas_medicas_cupo_idx" ON "fichas_medicas" USING btree ("cupo_id");