CREATE TABLE "rrhh_cargos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rrhh_cargos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" varchar(40) NOT NULL,
	"unidad_id" uuid NOT NULL,
	"cargo_organigrama_id" integer,
	"nombre" varchar(240) NOT NULL,
	"tipo_vinculacion" varchar(30) NOT NULL,
	"haber_basico" numeric(14, 2) DEFAULT '0' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rrhh_cargos_tipo_check" CHECK ("rrhh_cargos"."tipo_vinculacion" in ('planta', 'consultor_linea', 'contrato')),
	CONSTRAINT "rrhh_cargos_haber_check" CHECK ("rrhh_cargos"."haber_basico" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rrhh_descuentos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rrhh_descuentos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"planilla_item_id" integer NOT NULL,
	"concepto" varchar(180) NOT NULL,
	"tipo" varchar(30) DEFAULT 'otro' NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rrhh_descuentos_tipo_check" CHECK ("rrhh_descuentos"."tipo" in ('afp', 'rc_iva', 'anticipo', 'falta', 'otro')),
	CONSTRAINT "rrhh_descuentos_monto_check" CHECK ("rrhh_descuentos"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE "rrhh_movimientos_cargo" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rrhh_movimientos_cargo_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"personal_id" integer NOT NULL,
	"cargo_anterior_id" integer,
	"cargo_nuevo_id" integer NOT NULL,
	"motivo" varchar(500) NOT NULL,
	"fecha_efectiva" date NOT NULL,
	"registrado_por_usuario_id" uuid,
	"registrado_por_nombre" varchar(220),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rrhh_personal" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rrhh_personal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"documento" varchar(40) NOT NULL,
	"nombres" varchar(120) NOT NULL,
	"apellidos" varchar(160) NOT NULL,
	"cargo_id" integer NOT NULL,
	"tipo_vinculacion" varchar(30) NOT NULL,
	"fecha_ingreso" date NOT NULL,
	"fecha_fin_contrato" date,
	"email" varchar(240),
	"telefono" varchar(40),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rrhh_personal_tipo_check" CHECK ("rrhh_personal"."tipo_vinculacion" in ('planta', 'consultor_linea', 'contrato'))
);
--> statement-breakpoint
CREATE TABLE "rrhh_planilla_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rrhh_planilla_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"planilla_id" integer NOT NULL,
	"personal_id" integer NOT NULL,
	"haber_basico" numeric(14, 2) NOT NULL,
	"bonos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_ganado" numeric(14, 2) NOT NULL,
	"total_descuentos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"liquido_pagable" numeric(14, 2) NOT NULL,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rrhh_planillas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rrhh_planillas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"gestion" integer NOT NULL,
	"mes" integer NOT NULL,
	"estado" varchar(20) DEFAULT 'borrador' NOT NULL,
	"total_ganado" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_descuentos" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_liquido" numeric(16, 2) DEFAULT '0' NOT NULL,
	"creado_por_usuario_id" uuid,
	"creado_por_nombre" varchar(220),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rrhh_planillas_mes_check" CHECK ("rrhh_planillas"."mes" between 1 and 12),
	CONSTRAINT "rrhh_planillas_estado_check" CHECK ("rrhh_planillas"."estado" in ('borrador', 'revisada', 'cerrada'))
);
--> statement-breakpoint
ALTER TABLE "rrhh_cargos" ADD CONSTRAINT "rrhh_cargos_unidad_id_unidades_id_fk" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_cargos" ADD CONSTRAINT "rrhh_cargos_cargo_organigrama_id_cargos_organigrama_id_fk" FOREIGN KEY ("cargo_organigrama_id") REFERENCES "public"."cargos_organigrama"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_descuentos" ADD CONSTRAINT "rrhh_descuentos_planilla_item_id_rrhh_planilla_items_id_fk" FOREIGN KEY ("planilla_item_id") REFERENCES "public"."rrhh_planilla_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_movimientos_cargo" ADD CONSTRAINT "rrhh_movimientos_cargo_personal_id_rrhh_personal_id_fk" FOREIGN KEY ("personal_id") REFERENCES "public"."rrhh_personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_movimientos_cargo" ADD CONSTRAINT "rrhh_movimientos_cargo_cargo_anterior_id_rrhh_cargos_id_fk" FOREIGN KEY ("cargo_anterior_id") REFERENCES "public"."rrhh_cargos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_movimientos_cargo" ADD CONSTRAINT "rrhh_movimientos_cargo_cargo_nuevo_id_rrhh_cargos_id_fk" FOREIGN KEY ("cargo_nuevo_id") REFERENCES "public"."rrhh_cargos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_personal" ADD CONSTRAINT "rrhh_personal_cargo_id_rrhh_cargos_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."rrhh_cargos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_planilla_items" ADD CONSTRAINT "rrhh_planilla_items_planilla_id_rrhh_planillas_id_fk" FOREIGN KEY ("planilla_id") REFERENCES "public"."rrhh_planillas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rrhh_planilla_items" ADD CONSTRAINT "rrhh_planilla_items_personal_id_rrhh_personal_id_fk" FOREIGN KEY ("personal_id") REFERENCES "public"."rrhh_personal"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rrhh_cargos_codigo_uidx" ON "rrhh_cargos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "rrhh_cargos_unidad_activo_idx" ON "rrhh_cargos" USING btree ("unidad_id","activo");--> statement-breakpoint
CREATE INDEX "rrhh_descuentos_item_idx" ON "rrhh_descuentos" USING btree ("planilla_item_id");--> statement-breakpoint
CREATE INDEX "rrhh_movimientos_personal_fecha_idx" ON "rrhh_movimientos_cargo" USING btree ("personal_id","fecha_efectiva");--> statement-breakpoint
CREATE UNIQUE INDEX "rrhh_personal_documento_uidx" ON "rrhh_personal" USING btree ("documento");--> statement-breakpoint
CREATE INDEX "rrhh_personal_cargo_activo_idx" ON "rrhh_personal" USING btree ("cargo_id","activo");--> statement-breakpoint
CREATE UNIQUE INDEX "rrhh_planilla_items_personal_uidx" ON "rrhh_planilla_items" USING btree ("planilla_id","personal_id");--> statement-breakpoint
CREATE INDEX "rrhh_planilla_items_personal_idx" ON "rrhh_planilla_items" USING btree ("personal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rrhh_planillas_periodo_uidx" ON "rrhh_planillas" USING btree ("gestion","mes");
--> statement-breakpoint
UPDATE "cargos_organigrama"
SET "nombre" = 'Chofer del Ejecutivo y Coordinador', "updated_at" = now()
WHERE "codigo" = 'ALC-002';
--> statement-breakpoint
INSERT INTO "rrhh_cargos" ("codigo", "unidad_id", "cargo_organigrama_id", "nombre", "tipo_vinculacion", "haber_basico", "activo")
SELECT "codigo", "unidad_id", "id", "nombre", 'planta', 0, "activo"
FROM "cargos_organigrama"
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = excluded."nombre",
  "unidad_id" = excluded."unidad_id",
  "cargo_organigrama_id" = excluded."cargo_organigrama_id",
  "updated_at" = now();
