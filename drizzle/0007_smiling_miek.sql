CREATE TABLE "contrataciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(24) NOT NULL,
	"objeto" varchar(300) NOT NULL,
	"modalidad" varchar(60) NOT NULL,
	"estado" varchar(40) DEFAULT 'preparacion' NOT NULL,
	"monto_referencial" numeric(16, 2) DEFAULT '0' NOT NULL,
	"unidad_solicitante_id" uuid NOT NULL,
	"responsable_nombre" varchar(220),
	"fecha_inicio" date NOT NULL,
	"fecha_limite" date,
	"creado_por_usuario_id" uuid,
	"creado_por_nombre" varchar(220),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contrataciones_modalidad_check" CHECK ("contrataciones"."modalidad" in ('menor', 'anpe', 'licitacion_publica', 'directa', 'excepcion')),
	CONSTRAINT "contrataciones_estado_check" CHECK ("contrataciones"."estado" in ('preparacion', 'certificacion', 'convocatoria', 'evaluacion', 'adjudicado', 'contrato', 'ejecucion', 'pago', 'concluido', 'cancelado')),
	CONSTRAINT "contrataciones_monto_check" CHECK ("contrataciones"."monto_referencial" >= 0)
);
--> statement-breakpoint
CREATE TABLE "contrataciones_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contratacion_id" uuid NOT NULL,
	"estado" varchar(40) NOT NULL,
	"detalle" text,
	"actor_usuario_id" uuid,
	"actor_nombre" varchar(220),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contrataciones_secuencia" (
	"gestion" integer PRIMARY KEY NOT NULL,
	"ultimo" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contrataciones" ADD CONSTRAINT "contrataciones_unidad_solicitante_id_unidades_id_fk" FOREIGN KEY ("unidad_solicitante_id") REFERENCES "public"."unidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrataciones_eventos" ADD CONSTRAINT "contrataciones_eventos_contratacion_id_contrataciones_id_fk" FOREIGN KEY ("contratacion_id") REFERENCES "public"."contrataciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contrataciones_codigo_uidx" ON "contrataciones" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "contrataciones_estado_fecha_idx" ON "contrataciones" USING btree ("estado","fecha_inicio");--> statement-breakpoint
CREATE INDEX "contrataciones_unidad_idx" ON "contrataciones" USING btree ("unidad_solicitante_id");--> statement-breakpoint
CREATE INDEX "contrataciones_eventos_proceso_idx" ON "contrataciones_eventos" USING btree ("contratacion_id","created_at");