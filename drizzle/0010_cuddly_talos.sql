ALTER TABLE "agenda_actividades" ALTER COLUMN "estado" SET DEFAULT 'tentativa';--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD COLUMN "asistencia" varchar(30) DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD COLUMN "representante_cargo_codigo" varchar(30);--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD COLUMN "representante_cargo" varchar(240);--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD COLUMN "representante_unidad" varchar(180);--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD COLUMN "decision_por_usuario_id" uuid;--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD COLUMN "decision_por_nombre" varchar(220);--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD COLUMN "decision_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "agenda_actividades_asistencia_idx" ON "agenda_actividades" USING btree ("asistencia");--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD CONSTRAINT "agenda_actividades_asistencia_check" CHECK ("agenda_actividades"."asistencia" in ('pendiente', 'alcalde', 'designado'));--> statement-breakpoint
ALTER TABLE "agenda_actividades" ADD CONSTRAINT "agenda_actividades_representante_check" CHECK (("agenda_actividades"."asistencia" = 'designado' and "agenda_actividades"."representante_cargo" is not null) or ("agenda_actividades"."asistencia" <> 'designado' and "agenda_actividades"."representante_cargo_codigo" is null and "agenda_actividades"."representante_cargo" is null and "agenda_actividades"."representante_unidad" is null));