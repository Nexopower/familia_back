/*
  Agrega umbral default por negocio para alertas de stock bajo.
  - Columna: dbo.negocios.stockmin_default_neg INT NULL
  - Default: 5 (para mantener el comportamiento actual, pero configurable)
  - Constraint: >= 0 (o NULL)

  Ejecutar en SQL Server (una vez). Es idempotente.
*/

-- 1) Columna
IF COL_LENGTH('dbo.negocios', 'stockmin_default_neg') IS NULL
BEGIN
  ALTER TABLE dbo.negocios
    ADD stockmin_default_neg INT NULL;
END
GO

-- 2) Default constraint (para inserts futuros)
IF NOT EXISTS (
  SELECT 1
  FROM sys.default_constraints dc
  JOIN sys.columns c
    ON c.default_object_id = dc.object_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.negocios')
    AND c.name = 'stockmin_default_neg'
)
BEGIN
  ALTER TABLE dbo.negocios
    ADD CONSTRAINT DF_negocios_stockmin_default_neg DEFAULT (5) FOR stockmin_default_neg;
END
GO

-- 3) Inicializar existentes (si están en NULL)
UPDATE dbo.negocios
  SET stockmin_default_neg = 5
WHERE stockmin_default_neg IS NULL;
GO

-- 4) Check constraint (>=0 o NULL)
IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints cc
  WHERE cc.parent_object_id = OBJECT_ID('dbo.negocios')
    AND cc.name = 'CK_negocios_stockmin_default_neg_nonneg'
)
BEGIN
  ALTER TABLE dbo.negocios
    ADD CONSTRAINT CK_negocios_stockmin_default_neg_nonneg
      CHECK (stockmin_default_neg IS NULL OR stockmin_default_neg >= 0);
END
GO
