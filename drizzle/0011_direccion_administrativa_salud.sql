INSERT INTO "unidades" ("codigo", "nombre", "descripcion", "activa")
VALUES (
  'DAS',
  'Dirección Administrativa de Salud',
  'Gestión administrativa de los servicios municipales de salud y del Hospital Municipal.',
  true
)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "descripcion" = EXCLUDED."descripcion",
  "activa" = true,
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "cargos_organigrama" (
  "codigo", "unidad_id", "superior_codigo", "nombre", "nivel", "gestion", "orden", "activo"
)
SELECT
  'DAS-001', unidades.id, 'DH-001', 'Directora Administrativa Hospital Municipal',
  'direccion', 2026, 770, true
FROM "unidades"
WHERE unidades.codigo = 'DAS'
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
INSERT INTO "rrhh_cargos" (
  "codigo", "unidad_id", "cargo_organigrama_id", "nombre", "tipo_vinculacion", "haber_basico", "activo"
)
SELECT
  cargo.codigo, cargo.unidad_id, cargo.id, cargo.nombre, 'planta', 0, true
FROM "cargos_organigrama" cargo
WHERE cargo.codigo = 'DAS-001'
ON CONFLICT ("codigo") DO UPDATE SET
  "unidad_id" = EXCLUDED."unidad_id",
  "cargo_organigrama_id" = EXCLUDED."cargo_organigrama_id",
  "nombre" = EXCLUDED."nombre",
  "tipo_vinculacion" = EXCLUDED."tipo_vinculacion",
  "activo" = true,
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "rrhh_personal" (
  "documento", "nombres", "apellidos", "cargo_id", "tipo_vinculacion",
  "fecha_ingreso", "email", "activo"
)
SELECT
  'PENDIENTE-MELVI-ROMERO', 'Melvi', 'Romero', cargo.id, 'planta',
  DATE '2026-09-30', 'mel.2512@gmail.com', true
FROM "rrhh_cargos" cargo
WHERE cargo.codigo = 'DAS-001'
  AND NOT EXISTS (
    SELECT 1 FROM "rrhh_personal" personal
    WHERE lower(coalesce(personal.email, '')) = 'mel.2512@gmail.com'
       OR lower(personal.nombres || ' ' || personal.apellidos) = 'melvi romero'
  );
