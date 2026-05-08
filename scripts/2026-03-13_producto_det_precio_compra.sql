/*
  Agrega precio de compra a producto_det para soportar:
  - Precio de venta (precio_pdt)
  - Precio de compra (precio_compra_pdt)
*/

IF COL_LENGTH('dbo.producto_det', 'precio_compra_pdt') IS NULL
BEGIN
  ALTER TABLE dbo.producto_det
    ADD precio_compra_pdt decimal(18, 2) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_producto_det_precio_compra_nonneg'
)
BEGIN
  ALTER TABLE dbo.producto_det
    ADD CONSTRAINT CK_producto_det_precio_compra_nonneg
    CHECK (precio_compra_pdt IS NULL OR precio_compra_pdt >= 0);
END
GO
