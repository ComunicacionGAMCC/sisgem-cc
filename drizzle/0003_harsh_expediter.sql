CREATE TABLE "agenda_actividades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time,
	"titulo" varchar(220) NOT NULL,
	"lugar" varchar(220),
	"descripcion" text,
	"estado" varchar(30) DEFAULT 'confirmada' NOT NULL,
	"creado_por_usuario_id" uuid,
	"creado_por_nombre" varchar(220),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_actividades_estado_check" CHECK ("agenda_actividades"."estado" in ('confirmada', 'tentativa')),
	CONSTRAINT "agenda_actividades_horas_check" CHECK ("agenda_actividades"."hora_fin" is null or "agenda_actividades"."hora_fin" > "agenda_actividades"."hora_inicio")
);
--> statement-breakpoint
CREATE INDEX "agenda_actividades_fecha_hora_idx" ON "agenda_actividades" USING btree ("fecha","hora_inicio");--> statement-breakpoint
CREATE INDEX "agenda_actividades_estado_idx" ON "agenda_actividades" USING btree ("estado");