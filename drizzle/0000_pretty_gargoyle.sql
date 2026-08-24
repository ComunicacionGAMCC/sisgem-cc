CREATE TYPE "public"."estado_derivacion" AS ENUM('pendiente', 'recibida', 'atendida');--> statement-breakpoint
CREATE TYPE "public"."estado_hoja" AS ENUM('recibido', 'derivado', 'en_proceso', 'observado', 'finalizado', 'archivado');--> statement-breakpoint
CREATE TYPE "public"."prioridad_hoja" AS ENUM('baja', 'normal', 'alta', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."tipo_solicitante" AS ENUM('persona', 'institucion', 'unidad_interna');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entidad" varchar(80) NOT NULL,
	"entidad_id" uuid NOT NULL,
	"accion" varchar(80) NOT NULL,
	"funcionario_id" uuid,
	"detalle" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "derivaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hoja_ruta_id" uuid NOT NULL,
	"unidad_origen_id" uuid,
	"unidad_destino_id" uuid NOT NULL,
	"derivado_por_id" uuid,
	"recibido_por_id" uuid,
	"estado" "estado_derivacion" DEFAULT 'pendiente' NOT NULL,
	"nota" text,
	"derivado_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recibido_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos_seguimiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hoja_ruta_id" uuid NOT NULL,
	"estado" "estado_hoja" NOT NULL,
	"titulo" varchar(220) NOT NULL,
	"descripcion" text,
	"unidad_id" uuid,
	"funcionario_id" uuid,
	"publico" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funcionarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unidad_id" uuid NOT NULL,
	"nombres" varchar(120) NOT NULL,
	"apellidos" varchar(160) NOT NULL,
	"cargo" varchar(180) NOT NULL,
	"email" varchar(240),
	"telefono" varchar(40),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hojas_de_ruta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(24) NOT NULL,
	"tipo" varchar(80) DEFAULT 'solicitud_externa' NOT NULL,
	"asunto" varchar(300) NOT NULL,
	"descripcion" text,
	"prioridad" "prioridad_hoja" DEFAULT 'normal' NOT NULL,
	"estado" "estado_hoja" DEFAULT 'recibido' NOT NULL,
	"solicitante_id" uuid NOT NULL,
	"unidad_actual_id" uuid NOT NULL,
	"creado_por_id" uuid,
	"fecha_limite" timestamp with time zone,
	"finalizado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secuencias_codigo" (
	"gestion" integer PRIMARY KEY NOT NULL,
	"ultimo" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitantes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_solicitante" DEFAULT 'persona' NOT NULL,
	"nombre" varchar(220) NOT NULL,
	"documento" varchar(80),
	"organizacion" varchar(220),
	"email" varchar(240),
	"telefono" varchar(40),
	"direccion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"nombre" varchar(180) NOT NULL,
	"descripcion" text,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derivaciones" ADD CONSTRAINT "derivaciones_hoja_ruta_id_hojas_de_ruta_id_fk" FOREIGN KEY ("hoja_ruta_id") REFERENCES "public"."hojas_de_ruta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derivaciones" ADD CONSTRAINT "derivaciones_unidad_origen_id_unidades_id_fk" FOREIGN KEY ("unidad_origen_id") REFERENCES "public"."unidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derivaciones" ADD CONSTRAINT "derivaciones_unidad_destino_id_unidades_id_fk" FOREIGN KEY ("unidad_destino_id") REFERENCES "public"."unidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derivaciones" ADD CONSTRAINT "derivaciones_derivado_por_id_funcionarios_id_fk" FOREIGN KEY ("derivado_por_id") REFERENCES "public"."funcionarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derivaciones" ADD CONSTRAINT "derivaciones_recibido_por_id_funcionarios_id_fk" FOREIGN KEY ("recibido_por_id") REFERENCES "public"."funcionarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_seguimiento" ADD CONSTRAINT "eventos_seguimiento_hoja_ruta_id_hojas_de_ruta_id_fk" FOREIGN KEY ("hoja_ruta_id") REFERENCES "public"."hojas_de_ruta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_seguimiento" ADD CONSTRAINT "eventos_seguimiento_unidad_id_unidades_id_fk" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_seguimiento" ADD CONSTRAINT "eventos_seguimiento_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_unidad_id_unidades_id_fk" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hojas_de_ruta" ADD CONSTRAINT "hojas_de_ruta_solicitante_id_solicitantes_id_fk" FOREIGN KEY ("solicitante_id") REFERENCES "public"."solicitantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hojas_de_ruta" ADD CONSTRAINT "hojas_de_ruta_unidad_actual_id_unidades_id_fk" FOREIGN KEY ("unidad_actual_id") REFERENCES "public"."unidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hojas_de_ruta" ADD CONSTRAINT "hojas_de_ruta_creado_por_id_funcionarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."funcionarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "derivaciones_hoja_idx" ON "derivaciones" USING btree ("hoja_ruta_id");--> statement-breakpoint
CREATE INDEX "eventos_seguimiento_hoja_idx" ON "eventos_seguimiento" USING btree ("hoja_ruta_id");--> statement-breakpoint
CREATE INDEX "eventos_seguimiento_fecha_idx" ON "eventos_seguimiento" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "funcionarios_email_uidx" ON "funcionarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "funcionarios_unidad_idx" ON "funcionarios" USING btree ("unidad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hojas_de_ruta_codigo_uidx" ON "hojas_de_ruta" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "hojas_de_ruta_estado_idx" ON "hojas_de_ruta" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "hojas_de_ruta_unidad_idx" ON "hojas_de_ruta" USING btree ("unidad_actual_id");--> statement-breakpoint
CREATE INDEX "hojas_de_ruta_created_idx" ON "hojas_de_ruta" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "solicitantes_documento_uidx" ON "solicitantes" USING btree ("documento");--> statement-breakpoint
CREATE UNIQUE INDEX "unidades_codigo_uidx" ON "unidades" USING btree ("codigo");