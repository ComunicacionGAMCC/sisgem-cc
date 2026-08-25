CREATE TABLE "cargos_organigrama" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cargos_organigrama_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" varchar(30) NOT NULL,
	"unidad_id" uuid NOT NULL,
	"superior_codigo" varchar(30),
	"nombre" varchar(240) NOT NULL,
	"nivel" varchar(30) NOT NULL,
	"gestion" integer DEFAULT 2025 NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cargos_organigrama_nivel_check" CHECK ("cargos_organigrama"."nivel" in ('ejecutivo', 'asesoria', 'apoyo', 'direccion', 'jefatura', 'profesional', 'tecnico', 'auxiliar', 'operativo'))
);
--> statement-breakpoint
ALTER TABLE "cargos_organigrama" ADD CONSTRAINT "cargos_organigrama_unidad_id_unidades_id_fk" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cargos_organigrama_codigo_uidx" ON "cargos_organigrama" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "cargos_organigrama_unidad_idx" ON "cargos_organigrama" USING btree ("unidad_id","activo");--> statement-breakpoint
CREATE INDEX "cargos_organigrama_superior_idx" ON "cargos_organigrama" USING btree ("superior_codigo");
--> statement-breakpoint
INSERT INTO "unidades" ("codigo", "nombre", "descripcion", "activa") VALUES
  ('ALC', 'Alcaldía', 'Máxima autoridad ejecutiva municipal.', true),
  ('ASN', 'Asesoría de Desarrollo Normativo, Transparencia y Lucha Contra la Corrupción', 'Asesoramiento directo del Alcalde.', true),
  ('ASL', 'Asesoría Legal', 'Asesoramiento legal directo del Alcalde.', true),
  ('AUD', 'Auditoría Interna', 'Unidad de auditoría interna municipal.', true),
  ('COM', 'Unidad de Comunicación', 'Comunicación institucional dependiente del Alcalde.', true),
  ('RRHH', 'Recursos Humanos', 'Gestión del personal municipal.', true),
  ('GAB', 'Secretaría de Gabinete', 'Asistencia directa al despacho del Alcalde.', true),
  ('SM', 'Secretaría Municipal', 'Coordinación administrativa municipal.', true),
  ('INT', 'Defensa del Consumidor e Intendencia Municipal', 'Defensa del consumidor e intendencia.', true),
  ('FIN', 'Dirección de Finanzas', 'Dirección municipal de Finanzas.', true),
  ('REC', 'Dirección de Recaudaciones', 'Dirección municipal de Recaudaciones.', true),
  ('OBR', 'Dirección de Obras Públicas', 'Dirección municipal de Obras Públicas.', true),
  ('CAT', 'Dirección de Catastro Urbano y Rural', 'Dirección municipal de Catastro Urbano y Rural.', true),
  ('DAP', 'Dirección de Desarrollo Agropecuario y Medio Ambiente', 'Dirección municipal de Desarrollo Agropecuario y Medio Ambiente.', true),
  ('DH', 'Dirección de Desarrollo Humano y Social', 'Dirección municipal de Desarrollo Humano y Social.', true)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "descripcion" = EXCLUDED."descripcion",
  "activa" = true,
  "updated_at" = now();
--> statement-breakpoint
WITH catalogo (codigo, unidad_codigo, superior_codigo, nombre, nivel, orden) AS (VALUES
  ('ALC-001', 'ALC', NULL, 'Alcalde', 'ejecutivo', 10),
  ('ASN-001', 'ASN', 'ALC-001', 'Asesor de Desarrollo Normativo, Transparencia y Lucha Contra la Corrupción', 'asesoria', 20),
  ('ASL-001', 'ASL', 'ALC-001', 'Asesor Legal', 'asesoria', 30),
  ('AUD-001', 'AUD', 'ALC-001', 'Auditoría Interna', 'apoyo', 40),
  ('COM-001', 'COM', 'ALC-001', 'Profesional II Responsable de Comunicación', 'profesional', 50),
  ('RRHH-001', 'RRHH', 'ALC-001', 'Profesional I Responsable de Recursos Humanos', 'profesional', 60),
  ('ALC-002', 'ALC', 'ALC-001', 'Técnico II Chofer Ejecutivo', 'tecnico', 70),
  ('GAB-001', 'GAB', 'ALC-001', 'Técnico III Secretaria de Gabinete', 'tecnico', 80),
  ('SM-001', 'SM', 'ALC-001', 'Secretario Municipal', 'ejecutivo', 90),
  ('SM-002', 'SM', 'SM-001', 'Técnico IV de Secretaría Municipal', 'tecnico', 100),
  ('SM-003', 'SM', 'SM-001', 'Técnico V Guardia de Seguridad del Edificio Municipal', 'tecnico', 110),
  ('INT-001', 'INT', 'SM-001', 'Técnico I Responsable de Defensa del Consumidor e Intendencia Municipal', 'tecnico', 120),
  ('FIN-001', 'FIN', 'SM-001', 'Director de Finanzas', 'direccion', 200),
  ('FIN-002', 'FIN', 'FIN-001', 'Jefe de Unidad I de Contabilidad', 'jefatura', 210),
  ('FIN-003', 'FIN', 'FIN-002', 'Profesional I Responsable de Presupuesto', 'profesional', 220),
  ('FIN-004', 'FIN', 'FIN-002', 'Técnico I Responsable de Tesorería', 'tecnico', 230),
  ('FIN-005', 'FIN', 'FIN-001', 'Auxiliar I de Secretaría', 'auxiliar', 240),
  ('FIN-006', 'FIN', 'FIN-001', 'Limpieza I', 'operativo', 250),
  ('REC-001', 'REC', 'SM-001', 'Director de Recaudaciones', 'direccion', 300),
  ('REC-002', 'REC', 'REC-001', 'Jefe de Unidad I de Administración y Contrataciones', 'jefatura', 310),
  ('REC-003', 'REC', 'REC-002', 'Profesional III Responsable de Activos Fijos', 'profesional', 320),
  ('REC-004', 'REC', 'REC-002', 'Técnico I Responsable Administrativo de Contrataciones Menores', 'tecnico', 330),
  ('OBR-001', 'OBR', 'SM-001', 'Director de Obras Públicas', 'direccion', 400),
  ('OBR-002', 'OBR', 'OBR-001', 'Jefe de Unidad II de Sistemas', 'jefatura', 410),
  ('OBR-003', 'OBR', 'OBR-001', 'Jefe de Unidad II de Planificación y Proyectos', 'jefatura', 420),
  ('OBR-004', 'OBR', 'OBR-003', 'Profesional II Responsable de Alumbrado Público', 'profesional', 430),
  ('OBR-005', 'OBR', 'OBR-001', 'Técnico V Seguridad de la Biblioteca Municipal', 'tecnico', 440),
  ('OBR-006', 'OBR', 'OBR-001', 'Auxiliar I de Secretaría', 'auxiliar', 450),
  ('CAT-001', 'CAT', 'SM-001', 'Director de Catastro Urbano y Rural', 'direccion', 500),
  ('CAT-002', 'CAT', 'CAT-001', 'Jefe de Unidad II de Catastro', 'jefatura', 510),
  ('CAT-003', 'CAT', 'CAT-002', 'Profesional I Fiscal de Obras I', 'profesional', 520),
  ('CAT-004', 'CAT', 'CAT-001', 'Auxiliar I de Secretaría', 'auxiliar', 530),
  ('DAP-001', 'DAP', 'SM-001', 'Director de Desarrollo Agropecuario y Medio Ambiente', 'direccion', 600),
  ('DAP-002', 'DAP', 'DAP-001', 'Jefe de Unidad II Agropecuaria y Agroindustrial', 'jefatura', 610),
  ('DAP-003', 'DAP', 'DAP-001', 'Jefe de Unidad II de Administración del Hospital Municipal', 'jefatura', 620),
  ('DAP-004', 'DAP', 'DAP-001', 'Profesional II Responsable de Medio Ambiente, Gestión de Riesgo y Residuos Sólidos', 'profesional', 630),
  ('DAP-005', 'DAP', 'DAP-001', 'Auxiliar I de Secretaría', 'auxiliar', 640),
  ('DH-001', 'DH', 'SM-001', 'Director de Desarrollo Humano y Social', 'direccion', 700),
  ('DH-002', 'DH', 'DH-001', 'Jefe de Unidad II de Niña, Niño y SLIM', 'jefatura', 710),
  ('DH-003', 'DH', 'DH-001', 'Jefe de Unidad II de Salud', 'jefatura', 720),
  ('DH-004', 'DH', 'DH-003', 'Profesional I Responsable del SICO', 'profesional', 730),
  ('DH-005', 'DH', 'DH-001', 'Jefe de Unidad II de Educación', 'jefatura', 740),
  ('DH-006', 'DH', 'DH-005', 'Técnico I Responsable de Deporte, Cultura y Turismo', 'tecnico', 750),
  ('DH-007', 'DH', 'DH-001', 'Auxiliar I de Secretaría', 'auxiliar', 760)
)
INSERT INTO "cargos_organigrama" (
  "codigo", "unidad_id", "superior_codigo", "nombre", "nivel", "gestion", "orden", "activo"
)
SELECT
  catalogo.codigo, unidades.id, catalogo.superior_codigo, catalogo.nombre,
  catalogo.nivel, 2025, catalogo.orden, true
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
