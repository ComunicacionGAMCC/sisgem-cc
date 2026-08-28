CREATE TABLE "hojas_ruta_adjuntos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hoja_ruta_id" uuid NOT NULL,
	"evento_id" uuid,
	"nombre" varchar(240) NOT NULL,
	"tipo_mime" varchar(120) NOT NULL,
	"tamano_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"contenido_base64" text NOT NULL,
	"publico" boolean DEFAULT false NOT NULL,
	"subido_por_usuario_id" uuid,
	"subido_por_nombre" varchar(220),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hojas_ruta_adjuntos_tamano_check" CHECK ("hojas_ruta_adjuntos"."tamano_bytes" > 0 and "hojas_ruta_adjuntos"."tamano_bytes" <= 3145728)
);
--> statement-breakpoint
ALTER TABLE "eventos_seguimiento" ADD COLUMN "actor_usuario_id" uuid;--> statement-breakpoint
ALTER TABLE "eventos_seguimiento" ADD COLUMN "actor_nombre" varchar(220);--> statement-breakpoint
ALTER TABLE "hojas_ruta_adjuntos" ADD CONSTRAINT "hojas_ruta_adjuntos_hoja_ruta_id_hojas_de_ruta_id_fk" FOREIGN KEY ("hoja_ruta_id") REFERENCES "public"."hojas_de_ruta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hojas_ruta_adjuntos" ADD CONSTRAINT "hojas_ruta_adjuntos_evento_id_eventos_seguimiento_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos_seguimiento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hojas_ruta_adjuntos_hoja_fecha_idx" ON "hojas_ruta_adjuntos" USING btree ("hoja_ruta_id","created_at");--> statement-breakpoint
CREATE INDEX "hojas_ruta_adjuntos_evento_idx" ON "hojas_ruta_adjuntos" USING btree ("evento_id");