-- ═══════════════════════════════════════════════════════════════════════════
-- Script de datos de ejemplo para inventario avanzado
-- Ejecutar después de prueba.sql para tener datos iniciales
-- ═══════════════════════════════════════════════════════════════════════════

USE familia;
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- UNIDADES DE MEDIDA (catálogo global)
-- ═══════════════════════════════════════════════════════════════════════════

-- Limpiar si existe data previa
DELETE FROM dbo.producto_um;
DELETE FROM dbo.conversion_um;
DELETE FROM dbo.unidades_medida;
GO

-- Unidades de conteo
INSERT INTO dbo.unidades_medida (nombre_umd, simbolo_umd, tipo_umd) VALUES 
('Unidad', 'u', 'conteo'),
('Docena', 'doc', 'conteo'),
('Caja', 'caja', 'conteo'),
('Paquete', 'paq', 'conteo'),
('Par', 'par', 'conteo'),
('Millar', 'mil', 'conteo');
GO

-- Unidades de peso
INSERT INTO dbo.unidades_medida (nombre_umd, simbolo_umd, tipo_umd) VALUES 
('Kilogramo', 'kg', 'peso'),
('Gramo', 'g', 'peso'),
('Miligramo', 'mg', 'peso'),
('Libra', 'lb', 'peso'),
('Onza', 'oz', 'peso'),
('Tonelada', 't', 'peso');
GO

-- Unidades de volumen
INSERT INTO dbo.unidades_medida (nombre_umd, simbolo_umd, tipo_umd) VALUES 
('Litro', 'L', 'volumen'),
('Mililitro', 'ml', 'volumen'),
('Galón', 'gal', 'volumen'),
('Barril', 'bbl', 'volumen'),
('Centímetro cúbico', 'cc', 'volumen');
GO

-- Unidades de longitud
INSERT INTO dbo.unidades_medida (nombre_umd, simbolo_umd, tipo_umd) VALUES 
('Metro', 'm', 'longitud'),
('Centímetro', 'cm', 'longitud'),
('Milímetro', 'mm', 'longitud'),
('Pulgada', 'in', 'longitud'),
('Pie', 'ft', 'longitud'),
('Yarda', 'yd', 'longitud');
GO

PRINT 'Unidades de medida insertadas correctamente.';
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- CONVERSIONES DE EJEMPLO (se crean por negocio, aquí para negocio 1)
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar si existe el negocio 1
IF EXISTS (SELECT 1 FROM dbo.negocios WHERE codneg_neg = 1)
BEGIN
  DECLARE @codneg INT = 1;
  DECLARE @codumd_unidad INT, @codumd_docena INT, @codumd_caja INT, @codumd_paquete INT;
  DECLARE @codumd_kg INT, @codumd_g INT, @codumd_lb INT;
  DECLARE @codumd_L INT, @codumd_ml INT, @codumd_gal INT;

  -- Obtener IDs de unidades
  SELECT @codumd_unidad = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Unidad';
  SELECT @codumd_docena = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Docena';
  SELECT @codumd_caja = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Caja';
  SELECT @codumd_paquete = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Paquete';
  SELECT @codumd_kg = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Kilogramo';
  SELECT @codumd_g = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Gramo';
  SELECT @codumd_lb = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Libra';
  SELECT @codumd_L = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Litro';
  SELECT @codumd_ml = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Mililitro';
  SELECT @codumd_gal = codumd_umd FROM dbo.unidades_medida WHERE nombre_umd = 'Galón';

  -- Conversiones de conteo
  -- 1 docena = 12 unidades
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_docena, @codumd_unidad, 12);

  -- 1 caja = 24 unidades (ejemplo: cervezas)
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_caja, @codumd_unidad, 24);

  -- 1 paquete = 6 unidades
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_paquete, @codumd_unidad, 6);

  -- 1 caja = 4 paquetes
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_caja, @codumd_paquete, 4);

  -- Conversiones de peso
  -- 1 kg = 1000 g
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_kg, @codumd_g, 1000);

  -- 1 lb = 453.592 g
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_lb, @codumd_g, 453.592);

  -- 1 kg = 2.20462 lb
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_kg, @codumd_lb, 2.20462);

  -- Conversiones de volumen
  -- 1 L = 1000 ml
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_L, @codumd_ml, 1000);

  -- 1 galón = 3.78541 L
  INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv)
  VALUES (@codneg, @codumd_gal, @codumd_L, 3.78541);

  PRINT 'Conversiones de ejemplo insertadas para negocio 1.';
END
ELSE
BEGIN
  PRINT 'No existe el negocio 1, se omiten las conversiones de ejemplo.';
END
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAR DATOS INSERTADOS
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'Unidades de Medida' AS Tabla, COUNT(*) AS Total FROM dbo.unidades_medida;
SELECT 'Conversiones' AS Tabla, COUNT(*) AS Total FROM dbo.conversion_um;
GO

PRINT '═════════════════════════════════════════════════';
PRINT 'Script de datos de ejemplo ejecutado correctamente.';
PRINT '═════════════════════════════════════════════════';
GO
