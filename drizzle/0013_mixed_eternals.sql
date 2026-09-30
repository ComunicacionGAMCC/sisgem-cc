CREATE TABLE "rrhh_escalas_salariales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rrhh_escalas_salariales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"gestion" integer NOT NULL,
	"categoria" varchar(40) NOT NULL,
	"nivel" integer NOT NULL,
	"denominacion" varchar(180) NOT NULL,
	"numero_items" integer NOT NULL,
	"haber_basico" numeric(14, 2) NOT NULL,
	"costo_mensual" numeric(16, 2) NOT NULL,
	"entidad_codigo" varchar(20) NOT NULL,
	"fuente_codigo" varchar(20) NOT NULL,
	"organismo_financiador_codigo" varchar(20) NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rrhh_escalas_nivel_check" CHECK ("rrhh_escalas_salariales"."nivel" between 1 and 15),
	CONSTRAINT "rrhh_escalas_items_check" CHECK ("rrhh_escalas_salariales"."numero_items" > 0),
	CONSTRAINT "rrhh_escalas_montos_check" CHECK ("rrhh_escalas_salariales"."haber_basico" >= 0 and "rrhh_escalas_salariales"."costo_mensual" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rrhh_cargos" ADD COLUMN "escala_salarial_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "rrhh_escalas_gestion_nivel_uidx" ON "rrhh_escalas_salariales" USING btree ("gestion","nivel");--> statement-breakpoint
CREATE INDEX "rrhh_escalas_gestion_activa_idx" ON "rrhh_escalas_salariales" USING btree ("gestion","activa");--> statement-breakpoint
ALTER TABLE "rrhh_cargos" ADD CONSTRAINT "rrhh_cargos_escala_salarial_id_rrhh_escalas_salariales_id_fk" FOREIGN KEY ("escala_salarial_id") REFERENCES "public"."rrhh_escalas_salariales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rrhh_cargos_escala_idx" ON "rrhh_cargos" USING btree ("escala_salarial_id");
--> statement-breakpoint
INSERT INTO "rrhh_escalas_salariales" (
  "gestion", "categoria", "nivel", "denominacion", "numero_items", "haber_basico", "costo_mensual",
  "entidad_codigo", "fuente_codigo", "organismo_financiador_codigo", "activa"
) VALUES
  (2026, 'SUPERIOR', 1, 'ALCALDE', 1, 10814.00, 10814.00, '1755', '41', '113', true),
  (2026, 'SUPERIOR', 2, 'CONCEJALES', 7, 9509.00, 66563.00, '1755', '41', '113', true),
  (2026, 'SUPERIOR', 3, 'SECRETARIO MUNICIPAL', 1, 9010.00, 9010.00, '1755', '41', '113', true),
  (2026, 'EJECUTIVO', 4, 'ASESORES', 5, 8099.00, 40495.00, '1755', '41', '113', true),
  (2026, 'EJECUTIVO', 5, 'DIRECTORES', 7, 7948.00, 55636.00, '1755', '41', '113', true),
  (2026, 'EJECUTIVO', 6, 'AUDITOR', 1, 7420.00, 7420.00, '1755', '41', '113', true),
  (2026, 'EJECUTIVO', 7, 'JEFE DE UNIDAD I', 2, 6800.00, 13600.00, '1755', '41', '113', true),
  (2026, 'EJECUTIVO', 8, 'JEFE DE UNIDAD II', 6, 6280.00, 37680.00, '1755', '41', '113', true),
  (2026, 'OPERATIVO', 9, 'PROFESIONAL I', 4, 5800.00, 23200.00, '1755', '41', '113', true),
  (2026, 'OPERATIVO', 10, 'PROFESIONAL II', 4, 5000.00, 20000.00, '1755', '41', '113', true),
  (2026, 'OPERATIVO', 11, 'PROFESIONAL III', 1, 4500.00, 4500.00, '1755', '41', '113', true),
  (2026, 'OPERATIVO', 12, 'TÉCNICO I', 4, 4200.00, 16800.00, '1755', '41', '113', true),
  (2026, 'OPERATIVO', 13, 'TÉCNICO II', 1, 4000.00, 4000.00, '1755', '41', '113', true),
  (2026, 'OPERATIVO', 14, 'TÉCNICO III', 1, 3500.00, 3500.00, '1755', '41', '113', true),
  (2026, 'OPERATIVO', 15, 'TÉCNICO IV, AUXILIAR Y LIMPIEZA I', 13, 3300.00, 42900.00, '1755', '41', '113', true)
ON CONFLICT ("gestion", "nivel") DO UPDATE SET
  "categoria" = EXCLUDED."categoria",
  "denominacion" = EXCLUDED."denominacion",
  "numero_items" = EXCLUDED."numero_items",
  "haber_basico" = EXCLUDED."haber_basico",
  "costo_mensual" = EXCLUDED."costo_mensual",
  "entidad_codigo" = EXCLUDED."entidad_codigo",
  "fuente_codigo" = EXCLUDED."fuente_codigo",
  "organismo_financiador_codigo" = EXCLUDED."organismo_financiador_codigo",
  "activa" = true,
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "unidades" ("codigo", "nombre", "descripcion", "activa") VALUES
  ('CON', 'Concejo Municipal', 'Órgano deliberativo, fiscalizador y legislativo municipal.', true),
  ('DAS', 'Dirección Administrativa Municipal de Salud', 'Dirección responsable de la administración municipal de salud.', true)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "descripcion" = EXCLUDED."descripcion",
  "activa" = true,
  "updated_at" = now();
--> statement-breakpoint
UPDATE "cargos_organigrama"
SET "activo" = false, "updated_at" = now()
WHERE "codigo" NOT IN (
  'ALC-001','CON-001','ASN-001','ASL-001','AUD-001','COM-001','RRHH-001','ALC-002','GAB-001',
  'SM-001','SM-002','SM-003','INT-001','FIN-001','FIN-002','FIN-003','FIN-004','FIN-006',
  'REC-001','REC-002','REC-003','REC-004','OBR-001','OBR-002','OBR-003','OBR-004','OBR-005',
  'CAT-001','CAT-002','CAT-003','DAP-001','DAP-002','DAP-004','DAP-005',
  'DH-001','DH-002','DH-005','DH-006','DAS-001','DAS-002','DAS-003'
);
--> statement-breakpoint
WITH catalogo (codigo, unidad_codigo, superior_codigo, nombre, nivel, orden) AS (VALUES
  ('ALC-001', 'ALC', NULL, 'Alcalde', 'ejecutivo', 10),
  ('CON-001', 'CON', NULL, 'Concejal Municipal', 'ejecutivo', 15),
  ('ASN-001', 'ASN', 'ALC-001', 'Asesor de Desarrollo Normativo, Transparencia y Lucha Contra la Corrupción', 'asesoria', 20),
  ('ASL-001', 'ASL', 'ALC-001', 'Asesor Legal', 'asesoria', 30),
  ('AUD-001', 'AUD', 'ALC-001', 'Auditor Interno', 'apoyo', 40),
  ('COM-001', 'COM', 'ALC-001', 'Profesional II Responsable de Comunicación', 'profesional', 50),
  ('RRHH-001', 'RRHH', 'ALC-001', 'Responsable de Recursos Humanos', 'profesional', 60),
  ('ALC-002', 'ALC', 'ALC-001', 'Chofer del Ejecutivo y Coordinador', 'tecnico', 70),
  ('GAB-001', 'GAB', 'ALC-001', 'Técnico III Secretaría de Gabinete', 'tecnico', 80),
  ('SM-001', 'SM', 'ALC-001', 'Secretario Municipal', 'ejecutivo', 90),
  ('SM-002', 'SM', 'SM-001', 'Técnico V de Secretaría Municipal', 'tecnico', 100),
  ('SM-003', 'SM', 'SM-001', 'Técnico V Guardia de Seguridad del Edificio Municipal', 'tecnico', 110),
  ('INT-001', 'INT', 'SM-001', 'Técnico I Responsable de Defensa del Consumidor e Intendencia Municipal', 'tecnico', 120),
  ('FIN-001', 'FIN', 'SM-001', 'Director de Finanzas', 'direccion', 200),
  ('FIN-002', 'FIN', 'FIN-001', 'Jefe de Unidad I de Contabilidad', 'jefatura', 210),
  ('FIN-003', 'FIN', 'FIN-002', 'Profesional I Responsable de Presupuesto', 'profesional', 220),
  ('FIN-004', 'FIN', 'FIN-002', 'Técnico I Responsable de Tesorería', 'tecnico', 230),
  ('FIN-006', 'FIN', 'FIN-001', 'Limpieza I', 'operativo', 250),
  ('REC-001', 'REC', 'SM-001', 'Director de Recaudaciones', 'direccion', 300),
  ('REC-002', 'REC', 'REC-001', 'Jefe de Unidad I de Administración y Contrataciones', 'jefatura', 310),
  ('REC-003', 'REC', 'REC-002', 'Profesional III Responsable de Activos Fijos', 'profesional', 320),
  ('REC-004', 'REC', 'REC-002', 'Técnico I Responsable Administrativo de Contrataciones Menores', 'tecnico', 330),
  ('OBR-001', 'OBR', 'SM-001', 'Director de Obras Públicas', 'direccion', 400),
  ('OBR-002', 'OBR', 'OBR-001', 'Jefe de Unidad II de Fábrica de Losetas', 'jefatura', 410),
  ('OBR-003', 'OBR', 'OBR-001', 'Jefe de Unidad II de Obras Públicas', 'jefatura', 420),
  ('OBR-004', 'OBR', 'OBR-003', 'Profesional II Responsable de Alumbrado Público', 'profesional', 430),
  ('OBR-005', 'OBR', 'OBR-001', 'Técnico V Seguridad Biblioteca Municipal', 'tecnico', 440),
  ('CAT-001', 'CAT', 'SM-001', 'Director de Catastro Urbano y Rural', 'direccion', 500),
  ('CAT-002', 'CAT', 'CAT-001', 'Jefe de Unidad II de Administración de Desarrollo Urbano', 'jefatura', 510),
  ('CAT-003', 'CAT', 'CAT-002', 'Profesional I Fiscal de Obras I', 'profesional', 520),
  ('DAP-001', 'DAP', 'SM-001', 'Director de Desarrollo Agropecuario y Medio Ambiente', 'direccion', 600),
  ('DAP-002', 'DAP', 'DAP-001', 'Jefe de Unidad II Agropecuaria y Agroindustrial', 'jefatura', 610),
  ('DAP-004', 'DAP', 'DAP-001', 'Profesional II Responsable de Medio Ambiente, Gestión de Riesgo y Residuos Sólidos', 'profesional', 630),
  ('DAP-005', 'DAP', 'DAP-001', 'Auxiliar I Secretaría', 'auxiliar', 640),
  ('DH-001', 'DH', 'SM-001', 'Director de Desarrollo Humano y Social', 'direccion', 700),
  ('DH-002', 'DH', 'DH-001', 'Jefe de Unidad II Niña y SLIM', 'jefatura', 710),
  ('DH-005', 'DH', 'DH-001', 'Jefe de Unidad II de Educación', 'jefatura', 740),
  ('DH-006', 'DH', 'DH-005', 'Técnico I Responsable de Deporte, Cultura y Turismo', 'tecnico', 750),
  ('DAS-001', 'DAS', 'SM-001', 'Director Administrativo Municipal de Salud', 'direccion', 800),
  ('DAS-002', 'DAS', 'DAS-001', 'Jefe de Unidad II de Sistemas', 'jefatura', 810),
  ('DAS-003', 'DAS', 'DAS-001', 'Profesional I Responsable del SICO', 'profesional', 820)
)
INSERT INTO "cargos_organigrama" (
  "codigo", "unidad_id", "superior_codigo", "nombre", "nivel", "gestion", "orden", "activo"
)
SELECT catalogo.codigo, unidades.id, catalogo.superior_codigo, catalogo.nombre,
  catalogo.nivel, 2027, catalogo.orden, true
FROM catalogo
JOIN "unidades" ON unidades.codigo = catalogo.unidad_codigo
ON CONFLICT ("codigo") DO UPDATE SET
  "unidad_id" = EXCLUDED."unidad_id",
  "superior_codigo" = EXCLUDED."superior_codigo",
  "nombre" = EXCLUDED."nombre",
  "nivel" = EXCLUDED."nivel",
  "gestion" = EXCLUDED."gestion",
  "orden" = EXCLUDED."orden",
  "activo" = true,
  "updated_at" = now();
--> statement-breakpoint
WITH clasificacion (codigo, nivel_salarial) AS (VALUES
  ('ALC-001',1),('CON-001',2),('SM-001',3),('ASN-001',4),('ASL-001',4),('FIN-001',5),
  ('REC-001',5),('OBR-001',5),('CAT-001',5),('DAP-001',5),('DH-001',5),('DAS-001',5),
  ('AUD-001',6),('FIN-002',7),('REC-002',7),('OBR-002',8),('OBR-003',8),('CAT-002',8),
  ('DAP-002',8),('DH-002',8),('DH-005',8),('DAS-002',8),('RRHH-001',9),('FIN-003',9),
  ('CAT-003',9),('DAS-003',9),('COM-001',10),('OBR-004',10),('DAP-004',10),('REC-003',11),
  ('INT-001',12),('FIN-004',12),('REC-004',12),('DH-006',12),('ALC-002',13),('GAB-001',14),
  ('SM-002',15),('SM-003',15),('OBR-005',15),('DAP-005',15),('FIN-006',15)
)
INSERT INTO "rrhh_cargos" (
  "codigo", "unidad_id", "cargo_organigrama_id", "escala_salarial_id", "nombre", "tipo_vinculacion", "haber_basico", "activo"
)
SELECT cargo.codigo, cargo.unidad_id, cargo.id, escala.id, cargo.nombre, 'planta', escala.haber_basico, true
FROM clasificacion
JOIN "cargos_organigrama" cargo ON cargo.codigo = clasificacion.codigo
JOIN "rrhh_escalas_salariales" escala ON escala.gestion = 2026 AND escala.nivel = clasificacion.nivel_salarial
ON CONFLICT ("codigo") DO UPDATE SET
  "unidad_id" = EXCLUDED."unidad_id",
  "cargo_organigrama_id" = EXCLUDED."cargo_organigrama_id",
  "escala_salarial_id" = EXCLUDED."escala_salarial_id",
  "nombre" = EXCLUDED."nombre",
  "tipo_vinculacion" = 'planta',
  "haber_basico" = EXCLUDED."haber_basico",
  "activo" = true,
  "updated_at" = now();
--> statement-breakpoint
UPDATE "rrhh_cargos" rrhh
SET "activo" = false, "updated_at" = now()
FROM "cargos_organigrama" organigrama
WHERE rrhh."cargo_organigrama_id" = organigrama."id"
  AND organigrama."activo" = false;
--> statement-breakpoint
UPDATE "funcionarios" SET "cargo" = 'Director Administrativo Municipal de Salud', "updated_at" = now()
WHERE lower("cargo") = lower('Directora Administrativa Hospital Municipal');
--> statement-breakpoint
UPDATE "funcionarios" SET "cargo" = 'Responsable de Recursos Humanos', "updated_at" = now()
WHERE lower("cargo") = lower('Profesional I Responsable de Recursos Humanos');
