CREATE TABLE "notificaciones_dispositivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"clave_p256dh" text NOT NULL,
	"clave_auth" text NOT NULL,
	"nombre_completo" varchar(220) NOT NULL,
	"cargo" varchar(240),
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_acceso_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificaciones_entregas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispositivo_id" uuid NOT NULL,
	"actividad_id" uuid,
	"clave_unica" varchar(260) NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"estado" varchar(20) DEFAULT 'procesando' NOT NULL,
	"programada_at" timestamp with time zone,
	"enviada_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notificaciones_entregas_estado_check" CHECK ("notificaciones_entregas"."estado" in ('procesando', 'enviada', 'fallida'))
);
--> statement-breakpoint
ALTER TABLE "notificaciones_entregas" ADD CONSTRAINT "notificaciones_entregas_dispositivo_id_notificaciones_dispositivos_id_fk" FOREIGN KEY ("dispositivo_id") REFERENCES "public"."notificaciones_dispositivos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones_entregas" ADD CONSTRAINT "notificaciones_entregas_actividad_id_agenda_actividades_id_fk" FOREIGN KEY ("actividad_id") REFERENCES "public"."agenda_actividades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notificaciones_dispositivos_endpoint_uidx" ON "notificaciones_dispositivos" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "notificaciones_dispositivos_usuario_idx" ON "notificaciones_dispositivos" USING btree ("usuario_id","activo");--> statement-breakpoint
CREATE UNIQUE INDEX "notificaciones_entregas_clave_uidx" ON "notificaciones_entregas" USING btree ("clave_unica");--> statement-breakpoint
CREATE INDEX "notificaciones_entregas_actividad_idx" ON "notificaciones_entregas" USING btree ("actividad_id","tipo");