-- Script SQL Server (familia)
-- Convenciones aplicadas:
-- - Columnas con sufijo de 3 letras según tabla (ej. _per, _neg, _fac).
-- - Auditoría en todas las tablas: usercrea, usermod, fechcrea, fechmod.
-- - PK Identity: INT IDENTITY(1,1).

USE master;
GO

IF DB_ID('familia') IS NOT NULL
BEGIN
  ALTER DATABASE familia SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE familia;
END
GO

CREATE DATABASE familia;
GO

USE familia;
GO

-------------------------
-- 1) Tablas base
-------------------------



CREATE TABLE dbo.sexo (
  codsex_sex char(1) NOT NULL,
  nombre_sex varchar(10) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_sexo_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_sexo_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_sexo PRIMARY KEY (codsex_sex)
);
GO

-- CREATE TABLE dbo.tipos_negocio (
--   codtng_tng int IDENTITY(1,1) NOT NULL,
--   nombre_tng nvarchar(50) NOT NULL,
--   usercrea int NULL,
--   usermod int NULL,
--   fechcrea datetime NULL CONSTRAINT DF_tipos_negocio_fechcrea DEFAULT (getdate()),
--   fechmod datetime NULL CONSTRAINT DF_tipos_negocio_fechmod DEFAULT (getdate()),
--   CONSTRAINT PK_tipos_negocio PRIMARY KEY (codtng_tng),
--   CONSTRAINT UQ_tipos_negocio_nombre UNIQUE (nombre_tng)
-- );
-- GO

CREATE TABLE dbo.personas (
  codper_per int IDENTITY(1,1) NOT NULL,
  nombre_per nvarchar(50) NOT NULL,
  apellidos_per nvarchar(80) NOT NULL,
  edad_per int NULL,
  codsex_per char(1) NOT NULL,
  fecnac_per date NOT NULL,
  telper_per varchar(15) NULL,
  cedula_per varchar(20) NULL,
  email_per varchar(255) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_personas_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_personas_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_personas PRIMARY KEY (codper_per),
  CONSTRAINT UQ_personas_cedula UNIQUE (cedula_per),
  CONSTRAINT UQ_personas_email UNIQUE (email_per)
);
GO

-- CREATE TABLE dbo.configuracion_sistema (
--   codcfs_cfs int IDENTITY(1,1) NOT NULL,
--   parametros_cfs nvarchar(max) NULL,
--   usercrea int NULL,
--   usermod int NULL,
--   fechcrea datetime NULL CONSTRAINT DF_configuracion_sistema_fechcrea DEFAULT (getdate()),
--   fechmod datetime NULL CONSTRAINT DF_configuracion_sistema_fechmod DEFAULT (getdate()),
--   CONSTRAINT PK_configuracion_sistema PRIMARY KEY (codcfs_cfs)
-- );
-- GO
--
-- CREATE TABLE dbo.configuracion_negocio (
--   codcfn_cfn int IDENTITY(1,1) NOT NULL,
--   parametros_cfn nvarchar(max) NULL,
--   usercrea int NULL,
--   usermod int NULL,
--   fechcrea datetime NULL CONSTRAINT DF_configuracion_negocio_fechcrea DEFAULT (getdate()),
--   fechmod datetime NULL CONSTRAINT DF_configuracion_negocio_fechmod DEFAULT (getdate()),
--   CONSTRAINT PK_configuracion_negocio PRIMARY KEY (codcfn_cfn)
-- );
-- GO

CREATE TABLE dbo.roles (
  codrol_rol int IDENTITY(1,1) NOT NULL,
  nombre_rol nvarchar(80) NOT NULL,
  detalle_rol nvarchar(255) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_roles_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_roles_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_roles PRIMARY KEY (codrol_rol),
  CONSTRAINT UQ_roles_nombre UNIQUE (nombre_rol)
);
GO

-------------------------
-- 2) Núcleo multi-negocio
-------------------------

CREATE TABLE dbo.negocios (
  codneg_neg int IDENTITY(1,1) NOT NULL,
  nombre_neg nvarchar(100) NOT NULL,
--  codtng_neg int NOT NULL,
--  codcfn_neg int NULL,
  stockmin_default_neg int NULL CONSTRAINT DF_negocios_stockmin_default DEFAULT (5),
  estado_neg char(1) NOT NULL CONSTRAINT DF_negocios_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_negocios_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_negocios_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_negocios PRIMARY KEY (codneg_neg),
  CONSTRAINT UQ_negocios_nombre UNIQUE (nombre_neg),
  CONSTRAINT CK_negocios_stockmin_default_neg_nonneg CHECK (stockmin_default_neg IS NULL OR stockmin_default_neg >= 0)
);
GO

-- Usuarios (globales). El login se hace por nombre_usr.
-- Importante: nombre_usr NO es único globalmente. La pertenencia a un negocio se valida con dbo.usuario_negocio.
CREATE TABLE dbo.usuario (
  codusr_usr varchar(8) NOT NULL,
  codper_usr int NULL,
  codpad_usr varchar(8) NULL,
  codrol_usr int NULL,
  nombre_usr nvarchar(255) NOT NULL,
  passwo_usr nvarchar(255) NOT NULL,
  esdueno_usr bit NOT NULL CONSTRAINT DF_usuario_esdueno DEFAULT (0),
  loginmulti_usr bit NOT NULL CONSTRAINT DF_usuario_loginmulti DEFAULT (0), -- 1: puede iniciar sin seleccionar negocio y ver todos sus negocios
  estado_usr char(1) NOT NULL CONSTRAINT DF_usuario_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_usuario_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_usuario_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_usuario PRIMARY KEY (codusr_usr)
);
GO

-- Índice de búsqueda por credenciales (no único)
CREATE INDEX IX_usuario_login_nombre ON dbo.usuario (nombre_usr, passwo_usr);
GO

-- Dueños: nombre_usr único global cuando esdueno_usr=1
CREATE UNIQUE INDEX UX_usuario_dueno_nombre ON dbo.usuario (nombre_usr)
WHERE esdueno_usr = 1;
GO

-- Relación muchos-a-muchos: usuarios asignados a negocios
CREATE TABLE dbo.usuario_negocio (
  codusr_uneg varchar(8) NOT NULL,
  codneg_uneg int NOT NULL,
  codrol_uneg int NULL, -- rol opcional por negocio
  estado_uneg char(1) NOT NULL CONSTRAINT DF_usuario_negocio_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_usuario_negocio_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_usuario_negocio_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_usuario_negocio PRIMARY KEY (codusr_uneg, codneg_uneg)
);
GO

CREATE INDEX IX_usuario_negocio_negocio ON dbo.usuario_negocio (codneg_uneg);
GO
CREATE INDEX IX_usuario_negocio_usuario ON dbo.usuario_negocio (codusr_uneg);
GO

-- Propiedad del negocio: dueños/codueños (muchos-a-muchos)
CREATE TABLE dbo.negocio_dueno (
  codusr_ndu varchar(8) NOT NULL,
  codneg_ndu int NOT NULL,
  esprincipal_ndu bit NOT NULL CONSTRAINT DF_negocio_dueno_esprincipal DEFAULT (0),
  estado_ndu char(1) NOT NULL CONSTRAINT DF_negocio_dueno_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_negocio_dueno_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_negocio_dueno_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_negocio_dueno PRIMARY KEY (codusr_ndu, codneg_ndu)
);
GO

CREATE INDEX IX_negocio_dueno_negocio ON dbo.negocio_dueno (codneg_ndu);
GO

CREATE INDEX IX_negocio_dueno_usuario ON dbo.negocio_dueno (codusr_ndu);
GO

-------------------------
-- 3) Inventario
-------------------------

CREATE TABLE dbo.categorias (
  codcat_cat int IDENTITY(1,1) NOT NULL,
  nombre_cat nvarchar(50) NOT NULL,
  codneg_cat int NULL,
  estado_cat char(1) NOT NULL CONSTRAINT DF_categorias_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_categorias_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_categorias_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_categorias PRIMARY KEY (codcat_cat),
  CONSTRAINT UQ_categorias_negocio_nombre UNIQUE (codneg_cat, nombre_cat)
);
GO

CREATE TABLE dbo.marcas (
  codmar_mar int IDENTITY(1,1) NOT NULL,
  nombre_mar nvarchar(50) NOT NULL,
  codneg_mar int NULL,
  estado_mar char(1) NOT NULL CONSTRAINT DF_marcas_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_marcas_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_marcas_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_marcas PRIMARY KEY (codmar_mar),
  CONSTRAINT UQ_marcas_negocio_nombre UNIQUE (codneg_mar, nombre_mar)
);
GO

CREATE TABLE dbo.producto (
  codprd_prd int IDENTITY(1,1) NOT NULL,
  nombre_prd nvarchar(100) NOT NULL,
  codigo_prd nvarchar(50) NULL,
  codcat_prd int NULL,
  codmar_prd int NULL,
  codneg_prd int NOT NULL,
  stockmin_prd INT NULL,
  estado_prd char(1) NOT NULL CONSTRAINT DF_producto_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_producto_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_producto_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_producto PRIMARY KEY (codprd_prd),
  CONSTRAINT UQ_producto_negocio_codigo UNIQUE (codneg_prd, codigo_prd),
  CONSTRAINT CK_producto_stockmin_prd_nonneg CHECK (stockmin_prd IS NULL OR stockmin_prd >= 0)
);
GO

CREATE TABLE dbo.producto_det (
  codpdt_pdt int IDENTITY(1,1) NOT NULL,
  codprd_pdt int NOT NULL,
  precio_pdt decimal(18, 2) NOT NULL CONSTRAINT DF_producto_det_precio DEFAULT (0),
  precio_compra_pdt decimal(18, 2) NULL,
  existencia_pdt int NOT NULL CONSTRAINT DF_producto_det_existencia DEFAULT (0),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_producto_det_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_producto_det_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_producto_det PRIMARY KEY (codpdt_pdt),
  CONSTRAINT CK_producto_det_precio_compra_nonneg CHECK (precio_compra_pdt IS NULL OR precio_compra_pdt >= 0)
);
GO

CREATE TABLE dbo.inventario (
  codinv_inv int IDENTITY(1,1) NOT NULL,
  codprd_inv int NOT NULL,
  codneg_inv int NOT NULL,
  stock_inv int NOT NULL CONSTRAINT DF_inventario_stock DEFAULT (0),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_inventario_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_inventario_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_inventario PRIMARY KEY (codinv_inv),
  CONSTRAINT UQ_inventario_negocio_producto UNIQUE (codneg_inv, codprd_inv)
);
GO

CREATE TABLE dbo.movimientos_inventario (
  codmin_min int IDENTITY(1,1) NOT NULL,
  codinv_min int NOT NULL,
  tipo_min nvarchar(20) NOT NULL,
  cantidad_min int NOT NULL,
  fecha_min datetime NOT NULL CONSTRAINT DF_movimientos_inventario_fecha DEFAULT (getdate()),
  codusr_min varchar(8) NULL,
  detalle_min nvarchar(255) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_movimientos_inventario_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_movimientos_inventario_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_movimientos_inventario PRIMARY KEY (codmin_min)
);
GO

CREATE INDEX IX_movimientos_inventario_codinv ON dbo.movimientos_inventario (codinv_min);
GO
CREATE INDEX IX_movimientos_inventario_fecha ON dbo.movimientos_inventario (fecha_min);
GO

-------------------------
-- 4) Clientes y proveedores
-------------------------

CREATE TABLE dbo.clientes (
  codcli_cli int IDENTITY(1,1) NOT NULL,
  codper_cli int NOT NULL,
  codneg_cli int NOT NULL,
  estado_cli char(1) NOT NULL CONSTRAINT DF_clientes_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_clientes_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_clientes_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_clientes PRIMARY KEY (codcli_cli),
  CONSTRAINT UQ_clientes_negocio_persona UNIQUE (codneg_cli, codper_cli)
);
GO

CREATE TABLE dbo.proveedores (
  codpro_pro int IDENTITY(1,1) NOT NULL,
  codper_pro int NOT NULL,
  codneg_pro int NOT NULL,
  estado_pro char(1) NOT NULL CONSTRAINT DF_proveedores_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_proveedores_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_proveedores_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_proveedores PRIMARY KEY (codpro_pro),
  CONSTRAINT UQ_proveedores_negocio_persona UNIQUE (codneg_pro, codper_pro)
);
GO

-------------------------
-- 5) Facturación
-------------------------

CREATE TABLE dbo.facturas (
  codfac_fac int IDENTITY(1,1) NOT NULL,
  codneg_fac int NOT NULL,
  codcli_fac int NULL,
  codpro_fac int NULL,
  fecha_fac datetime NOT NULL CONSTRAINT DF_facturas_fecha DEFAULT (getdate()),
  total_fac decimal(18, 2) NOT NULL CONSTRAINT DF_facturas_total DEFAULT (0),
  tipo_fac nvarchar(20) NOT NULL,
  estado_fac nvarchar(20) NOT NULL CONSTRAINT DF_facturas_estado DEFAULT ('abierta'),
  codusr_fac varchar(8) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_facturas_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_facturas_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_facturas PRIMARY KEY (codfac_fac)
);
GO

CREATE INDEX IX_facturas_negocio_fecha ON dbo.facturas (codneg_fac, fecha_fac);
GO

CREATE TABLE dbo.factura_detalle (
  codfdt_fdt int IDENTITY(1,1) NOT NULL,
  codfac_fdt int NOT NULL,
  codprd_fdt int NOT NULL,
  cantidad_fdt int NOT NULL,
  preuni_fdt decimal(18, 2) NOT NULL CONSTRAINT DF_factura_detalle_preuni DEFAULT (0),
  subtotal_fdt decimal(18, 2) NOT NULL CONSTRAINT DF_factura_detalle_subtotal DEFAULT (0),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_factura_detalle_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_factura_detalle_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_factura_detalle PRIMARY KEY (codfdt_fdt)
);
GO

CREATE INDEX IX_factura_detalle_factura ON dbo.factura_detalle (codfac_fdt);
GO
CREATE INDEX IX_factura_detalle_producto ON dbo.factura_detalle (codprd_fdt);
GO

-------------------------
-- 6) Reservas / calendario
-------------------------

CREATE TABLE dbo.reservas (
  codres_res int IDENTITY(1,1) NOT NULL,
  codneg_res int NOT NULL,
  codcli_res int NOT NULL,
  fecini_res datetime NOT NULL,
  fecfin_res datetime NOT NULL,
  estado_res nvarchar(20) NOT NULL CONSTRAINT DF_reservas_estado DEFAULT ('pendiente'),
  detalle_res nvarchar(255) NULL,
  codusr_res varchar(8) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_reservas_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_reservas_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_reservas PRIMARY KEY (codres_res)
);
GO

CREATE INDEX IX_reservas_negocio_fecini ON dbo.reservas (codneg_res, fecini_res);
GO
CREATE INDEX IX_reservas_negocio_fecfin ON dbo.reservas (codneg_res, fecfin_res);
GO

CREATE TABLE dbo.calendario (
  codcal_cal int IDENTITY(1,1) NOT NULL,
  codneg_cal int NOT NULL,
  fecha_cal datetime NOT NULL,
  descri_cal nvarchar(255) NULL,
  tipo_cal nvarchar(20) NOT NULL,
  codusr_cal varchar(8) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_calendario_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_calendario_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_calendario PRIMARY KEY (codcal_cal)
);
GO

CREATE INDEX IX_calendario_negocio_fecha ON dbo.calendario (codneg_cal, fecha_cal);
GO

-------------------------
-- 7) Contabilidad (simple)
-------------------------

CREATE TABLE dbo.cuentas_contables (
  codcta_cta int IDENTITY(1,1) NOT NULL,
  nombre_cta nvarchar(100) NOT NULL,
  tipo_cta nvarchar(20) NOT NULL,
  codneg_cta int NULL,
  estado_cta char(1) NOT NULL CONSTRAINT DF_cuentas_contables_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_cuentas_contables_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_cuentas_contables_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_cuentas_contables PRIMARY KEY (codcta_cta),
  CONSTRAINT UQ_cuentas_contables_negocio_nombre UNIQUE (codneg_cta, nombre_cta)
);
GO

CREATE TABLE dbo.ingresos (
  coding_ing int IDENTITY(1,1) NOT NULL,
  codneg_ing int NOT NULL,
  codcta_ing int NOT NULL,
  monto_ing decimal(18, 2) NOT NULL,
  fecha_ing datetime NOT NULL CONSTRAINT DF_ingresos_fecha DEFAULT (getdate()),
  descri_ing nvarchar(255) NULL,
  refdoc_ing nvarchar(50) NULL,
  codusr_ing varchar(8) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_ingresos_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_ingresos_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_ingresos PRIMARY KEY (coding_ing)
);
GO

CREATE INDEX IX_ingresos_negocio_fecha ON dbo.ingresos (codneg_ing, fecha_ing);
GO

CREATE TABLE dbo.egresos (
  codegr_egr int IDENTITY(1,1) NOT NULL,
  codneg_egr int NOT NULL,
  codcta_egr int NOT NULL,
  monto_egr decimal(18, 2) NOT NULL,
  fecha_egr datetime NOT NULL CONSTRAINT DF_egresos_fecha DEFAULT (getdate()),
  descri_egr nvarchar(255) NULL,
  refdoc_egr nvarchar(50) NULL,
  codusr_egr varchar(8) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_egresos_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_egresos_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_egresos PRIMARY KEY (codegr_egr)
);
GO

CREATE INDEX IX_egresos_negocio_fecha ON dbo.egresos (codneg_egr, fecha_egr);
GO

-------------------------
-- 2.x) Seguridad / Tokens
-------------------------

CREATE TABLE dbo.refresh_tokens (
  codrft_rft int IDENTITY(1,1) NOT NULL,
  token_rft varchar(500) NOT NULL,
  codusr_rft varchar(8) NOT NULL,
  fecexp_rft datetime NOT NULL,
  feccre_rft datetime NOT NULL CONSTRAINT DF_refresh_tokens_feccre DEFAULT (getdate()),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_refresh_tokens_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_refresh_tokens_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_refresh_tokens PRIMARY KEY (codrft_rft),
  CONSTRAINT UQ_refresh_tokens_token UNIQUE (token_rft)
);
GO

CREATE INDEX IX_refresh_tokens_usuario ON dbo.refresh_tokens (codusr_rft);
GO

CREATE INDEX IX_refresh_tokens_expira ON dbo.refresh_tokens (fecexp_rft);
GO

CREATE TABLE dbo.token_blacklist (
  codtbl_tbl int IDENTITY(1,1) NOT NULL,
  token_tbl varchar(500) NOT NULL,
  fecrev_tbl datetime NOT NULL CONSTRAINT DF_token_blacklist_fecrev DEFAULT (getdate()),
  fecexp_tbl datetime NOT NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_token_blacklist_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_token_blacklist_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_token_blacklist PRIMARY KEY (codtbl_tbl),
  CONSTRAINT UQ_token_blacklist_token UNIQUE (token_tbl)
);
GO

CREATE INDEX IX_token_blacklist_expira ON dbo.token_blacklist (fecexp_tbl);
GO

-------------------------
-- 3.x) Inventario avanzado: Unidades, conversiones, recetas (BOM) y transformaciones
--      Permite productos compuestos (combos), empaques (caja->paquete->unidad) y conversi3n de insumos (gasolina)
-------------------------

CREATE TABLE dbo.unidades_medida (
  codumd_umd int IDENTITY(1,1) NOT NULL,
  nombre_umd nvarchar(50) NOT NULL,
  simbolo_umd nvarchar(10) NULL,
  tipo_umd nvarchar(20) NOT NULL, -- ej: 'volumen', 'conteo'
  estado_umd char(1) NOT NULL CONSTRAINT DF_unidades_medida_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_unidades_medida_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_unidades_medida_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_unidades_medida PRIMARY KEY (codumd_umd),
  CONSTRAINT UQ_unidades_medida_nombre UNIQUE (nombre_umd)
);
GO

-- Unidad base de inventario por producto y negocio
-- NOTA: Tu stock_inv y cantidad_min son INT; si manejar1s fracciones (0.5L), recomienda estandarizar la unidad mdima a enteros (ej: ml)
CREATE TABLE dbo.producto_um (
  codpum_pum int IDENTITY(1,1) NOT NULL,
  codneg_pum int NOT NULL,
  codprd_pum int NOT NULL,
  codumd_pum int NOT NULL,
  factor_inventario_pum decimal(18,6) NOT NULL CONSTRAINT DF_producto_um_factor DEFAULT (1),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_producto_um_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_producto_um_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_producto_um PRIMARY KEY (codpum_pum),
  CONSTRAINT UQ_producto_um UNIQUE (codneg_pum, codprd_pum)
);
GO

-- Conversi3n entre unidades de medida dentro de un negocio
-- Regla: cantidad_origen * factor_cnv = cantidad_destino
CREATE TABLE dbo.conversion_um (
  codcnv_cnv int IDENTITY(1,1) NOT NULL,
  codneg_cnv int NOT NULL,
  codumd_origen_cnv int NOT NULL,
  codumd_destino_cnv int NOT NULL,
  factor_cnv decimal(18,6) NOT NULL,
  estado_cnv char(1) NOT NULL CONSTRAINT DF_conversion_um_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_conversion_um_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_conversion_um_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_conversion_um PRIMARY KEY (codcnv_cnv),
  CONSTRAINT UQ_conversion_um UNIQUE (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv)
);
GO

CREATE INDEX IX_conversion_um_negocio ON dbo.conversion_um (codneg_cnv);
GO

-- Receta / composici3n: insumos requeridos para 1 unidad del producto final
CREATE TABLE dbo.producto_composicion (
  codpco_pco int IDENTITY(1,1) NOT NULL,
  codneg_pco int NOT NULL,
  codprd_final_pco int NOT NULL,
  codprd_insumo_pco int NOT NULL,
  cantidad_insumo_pco decimal(18,6) NOT NULL,
  estado_pco char(1) NOT NULL CONSTRAINT DF_producto_composicion_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_producto_composicion_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_producto_composicion_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_producto_composicion PRIMARY KEY (codpco_pco),
  CONSTRAINT UQ_producto_composicion UNIQUE (codneg_pco, codprd_final_pco, codprd_insumo_pco)
);
GO

CREATE INDEX IX_producto_composicion_final ON dbo.producto_composicion (codneg_pco, codprd_final_pco);
GO

-- Transformaciones: producci3n interna (ej: pasar de granel a botellas, de caja a paquetes)
CREATE TABLE dbo.transformaciones (
  codtrf_trf int IDENTITY(1,1) NOT NULL,
  codneg_trf int NOT NULL,
  fecha_trf datetime NOT NULL CONSTRAINT DF_transformaciones_fecha DEFAULT (getdate()),
  tipo_trf nvarchar(30) NOT NULL CONSTRAINT DF_transformaciones_tipo DEFAULT ('manual'),
  estado_trf nvarchar(20) NOT NULL CONSTRAINT DF_transformaciones_estado DEFAULT ('aplicada'),
  codusr_trf varchar(8) NULL,
  detalle_trf nvarchar(255) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_transformaciones_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_transformaciones_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_transformaciones PRIMARY KEY (codtrf_trf)
);
GO

CREATE TABLE dbo.transformaciones_det (
  codtfd_tfd int IDENTITY(1,1) NOT NULL,
  codtrf_tfd int NOT NULL,
  codprd_tfd int NOT NULL,
  tipo_tfd nvarchar(10) NOT NULL, -- 'salida' (insumo) | 'entrada' (producto resultante)
  cantidad_tfd int NOT NULL,
  detalle_tfd nvarchar(255) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_transformaciones_det_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_transformaciones_det_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_transformaciones_det PRIMARY KEY (codtfd_tfd)
);
GO

CREATE INDEX IX_transformaciones_det_trf ON dbo.transformaciones_det (codtrf_tfd);
GO

-------------------------
-- 8) Relaciones (FKs)
-------------------------

ALTER TABLE dbo.personas
  ADD CONSTRAINT FK_personas_sexo FOREIGN KEY (codsex_per) REFERENCES dbo.sexo(codsex_sex);
GO

-- ALTER TABLE dbo.negocios
--   ADD CONSTRAINT FK_negocios_tipo FOREIGN KEY (codtng_neg) REFERENCES dbo.tipos_negocio(codtng_tng);
-- GO

-- (No aplica) dbo.usuario ya no tiene columna codneg_usr, por eso no existe FK_usuario_negocio_base.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_usuario_negocio_base')
BEGIN
  EXEC(N'ALTER TABLE dbo.usuario DROP CONSTRAINT FK_usuario_negocio_base;');
END
GO

-- NOTA: Se retiró el modelo anterior que ligaba usuario->negocio (codneg_usr).

ALTER TABLE dbo.usuario
  ADD CONSTRAINT FK_usuario_persona FOREIGN KEY (codper_usr) REFERENCES dbo.personas(codper_per);
GO

ALTER TABLE dbo.usuario
  ADD CONSTRAINT FK_usuario_rol FOREIGN KEY (codrol_usr) REFERENCES dbo.roles(codrol_rol);
GO

-- (Eliminado) FK_usuario_negocio_base: dbo.usuario no tiene codneg_usr en este diseño.
-- ALTER TABLE dbo.usuario
--   ADD CONSTRAINT FK_usuario_negocio_base FOREIGN KEY (codneg_usr) REFERENCES dbo.negocios(codneg_neg);
-- GO

-- NOTA: Modelo vigente:
-- - Los negocios no guardan dueño como usuario en la tabla dbo.negocios.
-- - La pertenencia de usuarios a negocios se maneja en dbo.usuario_negocio.
-- - Propiedad (dueños/codueños) se maneja en dbo.negocio_dueno (muchos-a-muchos).
-- - Para login de trabajadores con selección de negocio: (codneg + nombre_usr + passwo_usr) y validar existencia en usuario_negocio.
-- - Para login sin seleccionar negocio (dueños y empleados habilitados): (nombre_usr + passwo_usr) y luego listar negocios vía negocio_dueno/usuario_negocio.

-- NOTA: Se retiró el modelo anterior que ligaba usuario->negocio (codneg_usr) y negocio->persona (codper_neg).
-- El modelo vigente para relación usuario-negocio es dbo.usuario_negocio.

-- (Compatibilidad) Si existiera una definici3n anterior en una versi3n previa del script, aseguramos que no se cree FK_usuario_negocio.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_usuario_negocio')
BEGIN
  EXEC(N'ALTER TABLE dbo.usuario DROP CONSTRAINT FK_usuario_negocio;');
END
GO

ALTER TABLE dbo.usuario_negocio
  ADD CONSTRAINT FK_usuario_negocio_usuario FOREIGN KEY (codusr_uneg) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.usuario_negocio
  ADD CONSTRAINT FK_usuario_negocio_negocio FOREIGN KEY (codneg_uneg) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.usuario_negocio
  ADD CONSTRAINT FK_usuario_negocio_rol FOREIGN KEY (codrol_uneg) REFERENCES dbo.roles(codrol_rol);
GO

ALTER TABLE dbo.negocio_dueno
  ADD CONSTRAINT FK_negocio_dueno_usuario FOREIGN KEY (codusr_ndu) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.negocio_dueno
  ADD CONSTRAINT FK_negocio_dueno_negocio FOREIGN KEY (codneg_ndu) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.categorias
  ADD CONSTRAINT FK_categorias_negocio FOREIGN KEY (codneg_cat) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.marcas
  ADD CONSTRAINT FK_marcas_negocio FOREIGN KEY (codneg_mar) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.producto
  ADD CONSTRAINT FK_producto_categoria FOREIGN KEY (codcat_prd) REFERENCES dbo.categorias(codcat_cat);
GO

ALTER TABLE dbo.producto
  ADD CONSTRAINT FK_producto_marca FOREIGN KEY (codmar_prd) REFERENCES dbo.marcas(codmar_mar);
GO

ALTER TABLE dbo.producto
  ADD CONSTRAINT FK_producto_negocio FOREIGN KEY (codneg_prd) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.producto_det
  ADD CONSTRAINT FK_producto_det_producto FOREIGN KEY (codprd_pdt) REFERENCES dbo.producto(codprd_prd);
GO

ALTER TABLE dbo.inventario
  ADD CONSTRAINT FK_inventario_producto FOREIGN KEY (codprd_inv) REFERENCES dbo.producto(codprd_prd);
GO

ALTER TABLE dbo.inventario
  ADD CONSTRAINT FK_inventario_negocio FOREIGN KEY (codneg_inv) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.movimientos_inventario
  ADD CONSTRAINT FK_movimientos_inventario_inventario FOREIGN KEY (codinv_min) REFERENCES dbo.inventario(codinv_inv);
GO

ALTER TABLE dbo.movimientos_inventario
  ADD CONSTRAINT FK_movimientos_inventario_usuario FOREIGN KEY (codusr_min) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.clientes
  ADD CONSTRAINT FK_clientes_persona FOREIGN KEY (codper_cli) REFERENCES dbo.personas(codper_per);
GO

ALTER TABLE dbo.clientes
  ADD CONSTRAINT FK_clientes_negocio FOREIGN KEY (codneg_cli) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.proveedores
  ADD CONSTRAINT FK_proveedores_persona FOREIGN KEY (codper_pro) REFERENCES dbo.personas(codper_per);
GO

ALTER TABLE dbo.proveedores
  ADD CONSTRAINT FK_proveedores_negocio FOREIGN KEY (codneg_pro) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.facturas
  ADD CONSTRAINT FK_facturas_negocio FOREIGN KEY (codneg_fac) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.facturas
  ADD CONSTRAINT FK_facturas_cliente FOREIGN KEY (codcli_fac) REFERENCES dbo.clientes(codcli_cli);
GO

ALTER TABLE dbo.facturas
  ADD CONSTRAINT FK_facturas_proveedor FOREIGN KEY (codpro_fac) REFERENCES dbo.proveedores(codpro_pro);
GO

ALTER TABLE dbo.facturas
  ADD CONSTRAINT FK_facturas_usuario FOREIGN KEY (codusr_fac) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.factura_detalle
  ADD CONSTRAINT FK_factura_detalle_factura FOREIGN KEY (codfac_fdt) REFERENCES dbo.facturas(codfac_fac);
GO

ALTER TABLE dbo.factura_detalle
  ADD CONSTRAINT FK_factura_detalle_producto FOREIGN KEY (codprd_fdt) REFERENCES dbo.producto(codprd_prd);
GO

ALTER TABLE dbo.reservas
  ADD CONSTRAINT FK_reservas_negocio FOREIGN KEY (codneg_res) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.reservas
  ADD CONSTRAINT FK_reservas_cliente FOREIGN KEY (codcli_res) REFERENCES dbo.clientes(codcli_cli);
GO

ALTER TABLE dbo.reservas
  ADD CONSTRAINT FK_reservas_usuario FOREIGN KEY (codusr_res) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.calendario
  ADD CONSTRAINT FK_calendario_negocio FOREIGN KEY (codneg_cal) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.calendario
  ADD CONSTRAINT FK_calendario_usuario FOREIGN KEY (codusr_cal) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.cuentas_contables
  ADD CONSTRAINT FK_cuentas_contables_negocio FOREIGN KEY (codneg_cta) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.ingresos
  ADD CONSTRAINT FK_ingresos_negocio FOREIGN KEY (codneg_ing) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.ingresos
  ADD CONSTRAINT FK_ingresos_cuenta FOREIGN KEY (codcta_ing) REFERENCES dbo.cuentas_contables(codcta_cta);
GO

ALTER TABLE dbo.ingresos
  ADD CONSTRAINT FK_ingresos_usuario FOREIGN KEY (codusr_ing) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.egresos
  ADD CONSTRAINT FK_egresos_negocio FOREIGN KEY (codneg_egr) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.egresos
  ADD CONSTRAINT FK_egresos_cuenta FOREIGN KEY (codcta_egr) REFERENCES dbo.cuentas_contables(codcta_cta);
GO

ALTER TABLE dbo.egresos
  ADD CONSTRAINT FK_egresos_usuario FOREIGN KEY (codusr_egr) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.refresh_tokens
  ADD CONSTRAINT FK_refresh_tokens_usuario FOREIGN KEY (codusr_rft) REFERENCES dbo.usuario(codusr_usr);
GO

-- (Correccin) Quitar FK incorrecto: token_blacklist no tiene codusr; no debe referenciar usuario a travs de usermod.
-- Si luego quieres asociar blacklist a usuario, agrega codusr_tbl varchar(8) NULL y su FK.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_token_blacklist_usuario')
BEGIN
  EXEC(N'ALTER TABLE dbo.token_blacklist DROP CONSTRAINT FK_token_blacklist_usuario;');
END
GO

ALTER TABLE dbo.producto_um
  ADD CONSTRAINT FK_producto_um_negocio FOREIGN KEY (codneg_pum) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.producto_um
  ADD CONSTRAINT FK_producto_um_producto FOREIGN KEY (codprd_pum) REFERENCES dbo.producto(codprd_prd);
GO

ALTER TABLE dbo.producto_um
  ADD CONSTRAINT FK_producto_um_unidad FOREIGN KEY (codumd_pum) REFERENCES dbo.unidades_medida(codumd_umd);
GO

ALTER TABLE dbo.conversion_um
  ADD CONSTRAINT FK_conversion_um_negocio FOREIGN KEY (codneg_cnv) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.conversion_um
  ADD CONSTRAINT FK_conversion_um_origen FOREIGN KEY (codumd_origen_cnv) REFERENCES dbo.unidades_medida(codumd_umd);
GO

ALTER TABLE dbo.conversion_um
  ADD CONSTRAINT FK_conversion_um_destino FOREIGN KEY (codumd_destino_cnv) REFERENCES dbo.unidades_medida(codumd_umd);
GO

ALTER TABLE dbo.producto_composicion
  ADD CONSTRAINT FK_producto_composicion_negocio FOREIGN KEY (codneg_pco) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.producto_composicion
  ADD CONSTRAINT FK_producto_composicion_final FOREIGN KEY (codprd_final_pco) REFERENCES dbo.producto(codprd_prd);
GO

ALTER TABLE dbo.producto_composicion
  ADD CONSTRAINT FK_producto_composicion_insumo FOREIGN KEY (codprd_insumo_pco) REFERENCES dbo.producto(codprd_prd);
GO

ALTER TABLE dbo.transformaciones
  ADD CONSTRAINT FK_transformaciones_negocio FOREIGN KEY (codneg_trf) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.transformaciones
  ADD CONSTRAINT FK_transformaciones_usuario FOREIGN KEY (codusr_trf) REFERENCES dbo.usuario(codusr_usr);
GO

ALTER TABLE dbo.transformaciones_det
  ADD CONSTRAINT FK_transformaciones_det_transformacion FOREIGN KEY (codtrf_tfd) REFERENCES dbo.transformaciones(codtrf_trf);
GO

ALTER TABLE dbo.transformaciones_det
  ADD CONSTRAINT FK_transformaciones_det_producto FOREIGN KEY (codprd_tfd) REFERENCES dbo.producto(codprd_prd);
GO

-------------------------
-- 9) Funciones, Stored Procedures y Triggers (lógica en BD)
------------------------------------------------------------

-- Limpieza idempotente (si se re-ejecuta el script)
IF OBJECT_ID('dbo.fn_stock_actual', 'FN') IS NOT NULL DROP FUNCTION dbo.fn_stock_actual;
GO
IF OBJECT_ID('dbo.fn_reserva_hay_solape', 'FN') IS NOT NULL DROP FUNCTION dbo.fn_reserva_hay_solape;
GO
IF OBJECT_ID('dbo.sp_inventario_asegurar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_inventario_asegurar;
GO
IF OBJECT_ID('dbo.sp_inventario_movimiento_registrar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_inventario_movimiento_registrar;
GO
IF OBJECT_ID('dbo.sp_factura_crear', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_factura_crear;
GO
IF OBJECT_ID('dbo.sp_factura_detalle_agregar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_factura_detalle_agregar;
GO
IF OBJECT_ID('dbo.sp_factura_cerrar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_factura_cerrar;
GO
IF OBJECT_ID('dbo.sp_reserva_crear', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_reserva_crear;
GO
IF OBJECT_ID('dbo.sp_reserva_reprogramar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_reserva_reprogramar;
GO
IF OBJECT_ID('dbo.sp_ingreso_registrar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_ingreso_registrar;
GO
IF OBJECT_ID('dbo.sp_egreso_registrar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_egreso_registrar;
GO
IF OBJECT_ID('dbo.sp_producto_composicion_set', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_producto_composicion_set;
GO
IF OBJECT_ID('dbo.sp_transformacion_registrar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_transformacion_registrar;
GO
IF OBJECT_ID('dbo.sp_venta_producto', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_venta_producto;
GO

IF OBJECT_ID('dbo.TR_factura_detalle_subtotal', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_factura_detalle_subtotal;
GO
IF OBJECT_ID('dbo.TR_factura_detalle_recalcular_total', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_factura_detalle_recalcular_total;
GO
IF OBJECT_ID('dbo.TR_facturas_validar_contraparte', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_facturas_validar_contraparte;
GO
IF OBJECT_ID('dbo.TR_movimientos_inventario_aplicar_stock', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_movimientos_inventario_aplicar_stock;
GO
IF OBJECT_ID('dbo.TR_reservas_validar_solape', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_reservas_validar_solape;
GO

-------------------------
-- 9.1) Funciones
-------------------------

CREATE FUNCTION dbo.fn_stock_actual (
  @codneg int,
  @codprd int
)
RETURNS int
AS
BEGIN
  DECLARE @stock int;

  SELECT @stock = i.stock_inv
  FROM dbo.inventario i
  WHERE i.codneg_inv = @codneg
    AND i.codprd_inv = @codprd;

  RETURN ISNULL(@stock, 0);
END;
GO

-- Devuelve 1 si existe solape de reservas dentro del negocio (ignorando canceladas)
CREATE FUNCTION dbo.fn_reserva_hay_solape (
  @codneg int,
  @fecini datetime,
  @fecfin datetime,
  @codres_excluir int = NULL
)
RETURNS bit
AS
BEGIN
  DECLARE @hay bit = 0;

  IF EXISTS (
    SELECT 1
    FROM dbo.reservas r
    WHERE r.codneg_res = @codneg
      AND r.estado_res <> 'cancelada'
      AND (@codres_excluir IS NULL OR r.codres_res <> @codres_excluir)
      AND r.fecini_res < @fecfin
      AND r.fecfin_res > @fecini
  )
  BEGIN
    SET @hay = 1;
  END

  RETURN @hay;
END;
GO

-------------------------
-- 9.2) Stored Procedures
-------------------------

-- Crea el registro en inventario si no existe (por negocio + producto)
CREATE PROCEDURE dbo.sp_inventario_asegurar
  @codneg int,
  @codprd int,
  @usercrea int = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL OR @codprd IS NULL
  BEGIN
    THROW 50010, N'codneg y codprd son requeridos.', 1;
  END

  BEGIN TRY
    BEGIN TRAN;

    IF NOT EXISTS (
      SELECT 1
      FROM dbo.inventario i WITH (UPDLOCK, HOLDLOCK)
      WHERE i.codneg_inv = @codneg AND i.codprd_inv = @codprd
    )
    BEGIN
      INSERT INTO dbo.inventario (codprd_inv, codneg_inv, stock_inv, usercrea)
      VALUES (@codprd, @codneg, 0, @usercrea);
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Registra un movimiento de inventario y deja que el trigger aplique el stock.
-- tipo_min: 'entrada' | 'salida' | 'ajuste'
CREATE PROCEDURE dbo.sp_inventario_movimiento_registrar
  @codneg int,
  @codprd int,
  @tipo nvarchar(20),
  @cantidad int,
  @detalle nvarchar(255) = NULL,
  @codusr varchar(8) = NULL,
  @usercrea int = NULL,
  @codmin_out int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL OR @codprd IS NULL
  BEGIN
    THROW 50011, N'codneg y codprd son requeridos.', 1;
  END

  IF @tipo NOT IN (N'entrada', N'salida', N'ajuste')
  BEGIN
    THROW 50012, N'tipo_min inválido. Use: entrada, salida, ajuste.', 1;
  END

  IF @cantidad IS NULL OR @cantidad <= 0
  BEGIN
    THROW 50013, N'cantidad debe ser mayor que 0.', 1;
  END

  BEGIN TRY
    BEGIN TRAN;

    EXEC dbo.sp_inventario_asegurar @codneg=@codneg, @codprd=@codprd, @usercrea=@usercrea;

    DECLARE @codinv int;

    SELECT @codinv = i.codinv_inv
    FROM dbo.inventario i WITH (UPDLOCK, HOLDLOCK)
    WHERE i.codneg_inv = @codneg
      AND i.codprd_inv = @codprd;

    IF @codinv IS NULL
    BEGIN
      THROW 50014, N'No se pudo asegurar inventario para el producto.', 1;
    END

    IF @tipo = N'salida'
    BEGIN
      DECLARE @stock int;
      SELECT @stock = stock_inv FROM dbo.inventario WHERE codinv_inv = @codinv;
      IF ISNULL(@stock, 0) < @cantidad
      BEGIN
        THROW 50015, N'Stock insuficiente para salida.', 1;
      END
    END

    INSERT INTO dbo.movimientos_inventario (codinv_min, tipo_min, cantidad_min, codusr_min, detalle_min, usercrea)
    VALUES (@codinv, @tipo, @cantidad, @codusr, @detalle, @usercrea);

    SET @codmin_out = SCOPE_IDENTITY();

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Crea una factura (venta o compra)
CREATE PROCEDURE dbo.sp_factura_crear
  @codneg int,
  @tipo nvarchar(20),
  @codcli int = NULL,
  @codpro int = NULL,
  @codusr varchar(8) = NULL,
  @usercrea int = NULL,
  @codfac_out int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL
  BEGIN
    THROW 50020, N'codneg es requerido.', 1;
  END

  IF @tipo NOT IN (N'venta', N'compra')
  BEGIN
    THROW 50021, N'tipo_fac inválido. Use: venta, compra.', 1;
  END

  IF @tipo = N'venta' AND (@codcli IS NULL OR @codpro IS NOT NULL)
  BEGIN
    THROW 50022, N'Para venta se requiere codcli_fac y codpro_fac debe ser NULL.', 1;
  END

  IF @tipo = N'compra' AND (@codpro IS NULL OR @codcli IS NOT NULL)
  BEGIN
    THROW 50023, N'Para compra se requiere codpro_fac y codcli_fac debe ser NULL.', 1;
  END

  BEGIN TRY
    BEGIN TRAN;

    INSERT INTO dbo.facturas (codneg_fac, codcli_fac, codpro_fac, tipo_fac, estado_fac, codusr_fac, total_fac, usercrea)
    VALUES (@codneg, @codcli, @codpro, @tipo, 'abierta', @codusr, 0, @usercrea);

    SET @codfac_out = SCOPE_IDENTITY();

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Agrega una línea a la factura (subtotal lo calculan triggers)
CREATE PROCEDURE dbo.sp_factura_detalle_agregar
  @codfac int,
  @codprd int,
  @cantidad int,
  @preuni decimal(18,2),
  @usercrea int = NULL,
  @codfdt_out int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  IF @codfac IS NULL OR @codprd IS NULL
  BEGIN
    THROW 50030, N'codfac y codprd son requeridos.', 1;
  END

  IF @cantidad IS NULL OR @cantidad <= 0
  BEGIN
    THROW 50031, N'cantidad debe ser mayor que 0.', 1;
  END

  IF @preuni IS NULL OR @preuni < 0
  BEGIN
    THROW 50032, N'preuni debe ser >= 0.', 1;
  END

  IF EXISTS (SELECT 1 FROM dbo.facturas WHERE codfac_fac = @codfac AND estado_fac <> 'abierta')
  BEGIN
    THROW 50033, N'No se puede modificar una factura que no esté en estado abierta.', 1;
  END

  BEGIN TRY
    BEGIN TRAN;

    INSERT INTO dbo.factura_detalle (codfac_fdt, codprd_fdt, cantidad_fdt, preuni_fdt, subtotal_fdt, usercrea)
    VALUES (@codfac, @codprd, @cantidad, @preuni, 0, @usercrea);

    SET @codfdt_out = SCOPE_IDENTITY();

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Cierra factura: valida totales y opcionalmente impacta inventario
CREATE PROCEDURE dbo.sp_factura_cerrar
  @codfac int,
  @codusr varchar(8) = NULL,
  @usercrea int = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @codfac IS NULL
  BEGIN
    THROW 50026, N'codfac es requerido.', 1;
  END

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @estado nvarchar(20);
    DECLARE @tipo nvarchar(20);
    DECLARE @codneg int;

    SELECT @estado = estado_fac, @tipo = tipo_fac, @codneg = codneg_fac
    FROM dbo.facturas WITH (UPDLOCK, HOLDLOCK)
    WHERE codfac_fac = @codfac;

    IF @estado IS NULL
    BEGIN
      THROW 50024, N'Factura no existe.', 1;
    END

    IF @estado <> N'abierta'
    BEGIN
      THROW 50025, N'La factura no está en estado abierta.', 1;
    END

    -- Recalcula total (por seguridad)
    DECLARE @total decimal(18,2);
    SELECT @total = ISNULL(SUM(subtotal_fdt), 0)
    FROM dbo.factura_detalle
    WHERE codfac_fdt = @codfac;

    UPDATE dbo.facturas
      SET total_fac = @total,
          estado_fac = 'cerrada',
          codusr_fac = COALESCE(@codusr, codusr_fac),
          usermod = @usercrea,
          fechmod = getdate()
    WHERE codfac_fac = @codfac;

    -- Impacto inventario (opcional, pero recomendado para centralizar lógica)
    -- venta: salida de stock; compra: entrada de stock
    IF @tipo IN ('venta', 'compra')
    BEGIN
      DECLARE @tipo_mov nvarchar(20) = CASE WHEN @tipo = 'venta' THEN 'salida' ELSE 'entrada' END;

      DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT fd.codprd_fdt, fd.cantidad_fdt
        FROM dbo.factura_detalle fd
        WHERE fd.codfac_fdt = @codfac;

      DECLARE @codprd int;
      DECLARE @cant int;
      DECLARE @codmin int;

      OPEN cur;
      FETCH NEXT FROM cur INTO @codprd, @cant;

      WHILE @@FETCH_STATUS = 0
      BEGIN
        DECLARE @detmov nvarchar(255) = N'Mov. por cierre factura ' + CAST(@codfac AS nvarchar(20));

        EXEC dbo.sp_inventario_movimiento_registrar
          @codneg = @codneg,
          @codprd = @codprd,
          @tipo = @tipo_mov,
          @cantidad = @cant,
          @detalle = @detmov,
          @codusr = @codusr,
          @usercrea = @usercrea,
          @codmin_out = @codmin OUTPUT;

        FETCH NEXT FROM cur INTO @codprd, @cant;
      END

      CLOSE cur;
      DEALLOCATE cur;
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Reserva: crea validando solapes
CREATE PROCEDURE dbo.sp_reserva_crear
  @codneg int,
  @codcli int,
  @fecini datetime,
  @fecfin datetime,
  @detalle nvarchar(255) = NULL,
  @codusr varchar(8) = NULL,
  @usercrea int = NULL,
  @codres_out int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL OR @codcli IS NULL
  BEGIN
    THROW 50040, N'codneg y codcli son requeridos.', 1;
  END

  IF @fecini IS NULL OR @fecfin IS NULL OR @fecini >= @fecfin
  BEGIN
    THROW 50041, N'Rango de fechas inválido (fecini < fecfin).', 1;
  END

  BEGIN TRY
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRAN;

    IF dbo.fn_reserva_hay_solape(@codneg, @fecini, @fecfin, NULL) = 1
    BEGIN
      THROW 50042, N'Existe un solape de reservas para ese rango de fechas.', 1;
    END

    INSERT INTO dbo.reservas (codneg_res, codcli_res, fecini_res, fecfin_res, estado_res, detalle_res, codusr_res, usercrea)
    VALUES (@codneg, @codcli, @fecini, @fecfin, 'pendiente', @detalle, @codusr, @usercrea);

    SET @codres_out = SCOPE_IDENTITY();

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Reserva: reprograma validando solapes
CREATE PROCEDURE dbo.sp_reserva_reprogramar
  @codres int,
  @fecini datetime,
  @fecfin datetime,
  @usercrea int = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @codres IS NULL
  BEGIN
    THROW 50050, N'codres es requerido.', 1;
  END

  IF @fecini IS NULL OR @fecfin IS NULL OR @fecini >= @fecfin
  BEGIN
    THROW 50051, N'Rango de fechas inválido (fecini < fecfin).', 1;
  END

  BEGIN TRY
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRAN;

    DECLARE @codneg int;
    SELECT @codneg = codneg_res
    FROM dbo.reservas WITH (UPDLOCK, HOLDLOCK)
    WHERE codres_res = @codres;

    IF @codneg IS NULL
    BEGIN
      THROW 50052, N'Reserva no existe.', 1;
    END

    IF dbo.fn_reserva_hay_solape(@codneg, @fecini, @fecfin, @codres) = 1
    BEGIN
      THROW 50053, N'Existe un solape de reservas para ese rango de fechas.', 1;
    END

    UPDATE dbo.reservas
      SET fecini_res = @fecini,
          fecfin_res = @fecfin,
          usermod = @usercrea,
          fechmod = getdate()
    WHERE codres_res = @codres;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Contabilidad simple
CREATE PROCEDURE dbo.sp_ingreso_registrar
  @codneg int,
  @codcta int,
  @monto decimal(18,2),
  @descri nvarchar(255) = NULL,
  @refdoc nvarchar(50) = NULL,
  @codusr varchar(8) = NULL,
  @usercrea int = NULL,
  @coding_out int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL OR @codcta IS NULL
  BEGIN
    THROW 50060, N'codneg y codcta son requeridos.', 1;
  END

  IF @monto IS NULL OR @monto <= 0
  BEGIN
    THROW 50061, N'monto debe ser mayor que 0.', 1;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.cuentas_contables WHERE codcta_cta = @codcta AND estado_cta = 'A')
  BEGIN
    THROW 50062, N'Cuenta contable inválida o inactiva.', 1;
  END

  BEGIN TRY
    INSERT INTO dbo.ingresos (codneg_ing, codcta_ing, monto_ing, fecha_ing, descri_ing, refdoc_ing, codusr_ing, usercrea)
    VALUES (@codneg, @codcta, @monto, getdate(), @descri, @refdoc, @codusr, @usercrea);

    SET @coding_out = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH
END;
GO

CREATE PROCEDURE dbo.sp_egreso_registrar
  @codneg int,
  @codcta int,
  @monto decimal(18,2),
  @descri nvarchar(255) = NULL,
  @refdoc nvarchar(50) = NULL,
  @codusr varchar(8) = NULL,
  @usercrea int = NULL,
  @codegr_out int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL OR @codcta IS NULL
  BEGIN
    THROW 50070, N'codneg y codcta son requeridos.', 1;
  END

  IF @monto IS NULL OR @monto <= 0
  BEGIN
    THROW 50071, N'monto debe ser mayor que 0.', 1;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.cuentas_contables WHERE codcta_cta = @codcta AND estado_cta = 'A')
  BEGIN
    THROW 50072, N'Cuenta contable inválida o inactiva.', 1;
  END

  BEGIN TRY
    INSERT INTO dbo.egresos (codneg_egr, codcta_egr, monto_egr, fecha_egr, descri_egr, refdoc_egr, codusr_egr, usercrea)
    VALUES (@codneg, @codcta, @monto, getdate(), @descri, @refdoc, @codusr, @usercrea);

    SET @codegr_out = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH
END;
GO

-------------------------
-- 9.2.x) Inventario compuesto (BOM) y transformaciones

-- Reemplaza receta de un producto final por negocio.
-- Formato JSON: [{"codprd_insumo":1,"cantidad":0.5},{"codprd_insumo":2,"cantidad":1}]
CREATE PROCEDURE dbo.sp_producto_composicion_set
  @codneg int,
  @codprd_final int,
  @insumos_json nvarchar(max),
  @usercrea int = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL OR @codprd_final IS NULL
  BEGIN
    THROW 50100, N'codneg y codprd_final son requeridos.', 1;
  END

  IF @insumos_json IS NULL OR ISJSON(@insumos_json) <> 1
  BEGIN
    THROW 50101, N'insumos_json inválido (se requiere JSON).', 1;
  END

  BEGIN TRY
    BEGIN TRAN;

    DELETE FROM dbo.producto_composicion
    WHERE codneg_pco = @codneg
      AND codprd_final_pco = @codprd_final;

    INSERT INTO dbo.producto_composicion (codneg_pco, codprd_final_pco, codprd_insumo_pco, cantidad_insumo_pco, usercrea)
    SELECT
      @codneg,
      @codprd_final,
      j.codprd_insumo,
      j.cantidad,
      @usercrea
    FROM OPENJSON(@insumos_json)
    WITH (
      codprd_insumo int '$.codprd_insumo',
      cantidad decimal(18,6) '$.cantidad'
    ) j
    WHERE j.codprd_insumo IS NOT NULL
      AND j.cantidad IS NOT NULL
      AND j.cantidad > 0;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Registra una transformaci3n (salidas/entradas) y aplica movimientos de inventario.
-- payload_json: {"detalle":"...","tipo":"manual","items":[{"codprd":1,"tipo":"salida","cantidad":10},{"codprd":2,"tipo":"entrada","cantidad":5}]}
CREATE PROCEDURE dbo.sp_transformacion_registrar
  @codneg int,
  @payload_json nvarchar(max),
  @codusr varchar(8) = NULL,
  @usercrea int = NULL,
  @codtrf_out int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL
  BEGIN
    THROW 50110, N'codneg es requerido.', 1;
  END

  IF @payload_json IS NULL OR ISJSON(@payload_json) <> 1
  BEGIN
    THROW 50111, N'payload_json inválido (se requiere JSON).', 1;
  END

  BEGIN TRY
    BEGIN TRAN;

    DECLARE @detalle nvarchar(255) = JSON_VALUE(@payload_json, '$.detalle');
    DECLARE @tipo nvarchar(30) = COALESCE(JSON_VALUE(@payload_json, '$.tipo'), 'manual');

    INSERT INTO dbo.transformaciones (codneg_trf, tipo_trf, codusr_trf, detalle_trf, usercrea)
    VALUES (@codneg, @tipo, @codusr, @detalle, @usercrea);

    SET @codtrf_out = SCOPE_IDENTITY();

    INSERT INTO dbo.transformaciones_det (codtrf_tfd, codprd_tfd, tipo_tfd, cantidad_tfd, detalle_tfd, usercrea)
    SELECT
      @codtrf_out,
      j.codprd,
      j.tipo,
      j.cantidad,
      j.detalle,
      @usercrea
    FROM OPENJSON(@payload_json, '$.items')
    WITH (
      codprd int '$.codprd',
      tipo nvarchar(10) '$.tipo',
      cantidad int '$.cantidad',
      detalle nvarchar(255) '$.detalle'
    ) j
    WHERE j.codprd IS NOT NULL
      AND j.tipo IN (N'entrada', N'salida')
      AND j.cantidad IS NOT NULL
      AND j.cantidad > 0;

    -- Aplica inventario usando el SP central
    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
      SELECT codprd_tfd, tipo_tfd, cantidad_tfd
      FROM dbo.transformaciones_det
      WHERE codtrf_tfd = @codtrf_out;

    DECLARE @codprd int;
    DECLARE @tipo_mov nvarchar(10);
    DECLARE @cant int;
    DECLARE @codmin int;
    DECLARE @detmov nvarchar(255);

    OPEN cur;
    FETCH NEXT FROM cur INTO @codprd, @tipo_mov, @cant;

    WHILE @@FETCH_STATUS = 0
    BEGIN
      SET @detmov = N'Transformacion ' + CAST(@codtrf_out AS nvarchar(20));

      EXEC dbo.sp_inventario_movimiento_registrar
        @codneg = @codneg,
        @codprd = @codprd,
        @tipo = @tipo_mov,
        @cantidad = @cant,
        @detalle = @detmov,
        @codusr = @codusr,
        @usercrea = @usercrea,
        @codmin_out = @codmin OUTPUT;

      FETCH NEXT FROM cur INTO @codprd, @tipo_mov, @cant;
    END

    CLOSE cur;
    DEALLOCATE cur;

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- Venta de producto final que consume insumos si existe receta.
-- Si no existe receta, descuenta el producto final (venta normal).
-- NOTA: actualmente cantidades son INT; si la receta contiene fracciones se debe estandarizar unidad mdima.
CREATE PROCEDURE dbo.sp_venta_producto
  @codneg int,
  @codprd_final int,
  @cantidad int,
  @codusr varchar(8) = NULL,
  @usercrea int = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @codneg IS NULL OR @codprd_final IS NULL
  BEGIN
    THROW 50120, N'codneg y codprd_final son requeridos.', 1;
  END

  IF @cantidad IS NULL OR @cantidad <= 0
  BEGIN
    THROW 50121, N'cantidad debe ser mayor que 0.', 1;
  END

  BEGIN TRY
    BEGIN TRAN;

    IF EXISTS (
      SELECT 1
      FROM dbo.producto_composicion pc
      WHERE pc.codneg_pco = @codneg
        AND pc.codprd_final_pco = @codprd_final
        AND pc.estado_pco = 'A'
    )
    BEGIN
      DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT pc.codprd_insumo_pco, pc.cantidad_insumo_pco
        FROM dbo.producto_composicion pc
        WHERE pc.codneg_pco = @codneg
          AND pc.codprd_final_pco = @codprd_final
          AND pc.estado_pco = 'A';

      DECLARE @codprd_ins int;
      DECLARE @cant_ins decimal(18,6);
      DECLARE @cant_total decimal(18,6);
      DECLARE @cant_total_int int;
      DECLARE @codmin int;
      DECLARE @detcons nvarchar(255);

      OPEN cur;
      FETCH NEXT FROM cur INTO @codprd_ins, @cant_ins;

      WHILE @@FETCH_STATUS = 0
      BEGIN
        SET @cant_total = @cant_ins * @cantidad;
        SET @cant_total_int = CEILING(@cant_total);
        SET @detcons = N'Consumo por venta de producto ' + CAST(@codprd_final AS nvarchar(20));

        EXEC dbo.sp_inventario_movimiento_registrar
          @codneg = @codneg,
          @codprd = @codprd_ins,
          @tipo = N'salida',
          @cantidad = @cant_total_int,
          @detalle = @detcons,
          @codusr = @codusr,
          @usercrea = @usercrea,
          @codmin_out = @codmin OUTPUT;

        FETCH NEXT FROM cur INTO @codprd_ins, @cant_ins;
      END

      CLOSE cur;
      DEALLOCATE cur;
    END
    ELSE
    BEGIN
      DECLARE @codmin2 int;
      EXEC dbo.sp_inventario_movimiento_registrar
        @codneg = @codneg,
        @codprd = @codprd_final,
        @tipo = N'salida',
        @cantidad = @cantidad,
        @detalle = N'Venta producto',
        @codusr = @codusr,
        @usercrea = @usercrea,
        @codmin_out = @codmin2 OUTPUT;
    END

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO


-------------------------
-- 10) Seguridad avanzada (RBAC): Permisos + asignación (global y por negocio)
-------------------------

IF OBJECT_ID('dbo.permisos', 'U') IS NOT NULL DROP TABLE dbo.permisos;
GO
IF OBJECT_ID('dbo.rol_permiso', 'U') IS NOT NULL DROP TABLE dbo.rol_permiso;
GO
IF OBJECT_ID('dbo.usuario_rol_global', 'U') IS NOT NULL DROP TABLE dbo.usuario_rol_global;
GO
IF OBJECT_ID('dbo.usuario_permiso_global', 'U') IS NOT NULL DROP TABLE dbo.usuario_permiso_global;
GO

CREATE TABLE dbo.permisos (
  codprm_prm int IDENTITY(1,1) NOT NULL,
  clave_prm nvarchar(120) NOT NULL,         -- ej: 'NEGOCIO.VER', 'INVENTARIO.MOVIMIENTO.CREAR'
  nombre_prm nvarchar(120) NOT NULL,
  detalle_prm nvarchar(255) NULL,
  estado_prm char(1) NOT NULL CONSTRAINT DF_permisos_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_permisos_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_permisos_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_permisos PRIMARY KEY (codprm_prm),
  CONSTRAINT UQ_permisos_clave UNIQUE (clave_prm)
);
GO

CREATE TABLE dbo.rol_permiso (
  codrpe_rpe int IDENTITY(1,1) NOT NULL,
  codrol_rpe int NOT NULL,
  codprm_rpe int NOT NULL,
  estado_rpe char(1) NOT NULL CONSTRAINT DF_rol_permiso_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_rol_permiso_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_rol_permiso_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_rol_permiso PRIMARY KEY (codrpe_rpe),
  CONSTRAINT UQ_rol_permiso UNIQUE (codrol_rpe, codprm_rpe)
);
GO

-- Roles globales (no amarrados a usuario_negocio)
CREATE TABLE dbo.usuario_rol_global (
  codurg_urg int IDENTITY(1,1) NOT NULL,
  codusr_urg varchar(8) NOT NULL,
  codrol_urg int NOT NULL,
  estado_urg char(1) NOT NULL CONSTRAINT DF_usuario_rol_global_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_usuario_rol_global_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_usuario_rol_global_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_usuario_rol_global PRIMARY KEY (codurg_urg),
  CONSTRAINT UQ_usuario_rol_global UNIQUE (codusr_urg, codrol_urg)
);
GO

-- Permisos globales directos (opcional, para excepciones)
CREATE TABLE dbo.usuario_permiso_global (
  codupg_upg int IDENTITY(1,1) NOT NULL,
  codusr_upg varchar(8) NOT NULL,
  codprm_upg int NOT NULL,
  permitido_upg bit NOT NULL CONSTRAINT DF_usuario_permiso_global_permitido DEFAULT (1),
  estado_upg char(1) NOT NULL CONSTRAINT DF_usuario_permiso_global_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_usuario_permiso_global_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_usuario_permiso_global_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_usuario_permiso_global PRIMARY KEY (codupg_upg),
  CONSTRAINT UQ_usuario_permiso_global UNIQUE (codusr_upg, codprm_upg)
);
GO

ALTER TABLE dbo.rol_permiso
  ADD CONSTRAINT FK_rol_permiso_permiso FOREIGN KEY (codprm_rpe) REFERENCES dbo.permisos(codprm_prm);
GO

ALTER TABLE dbo.usuario_permiso_global
  ADD CONSTRAINT FK_usuario_permiso_global_permiso FOREIGN KEY (codprm_upg) REFERENCES dbo.permisos(codprm_prm);
GO

-------------------------
-- 10.1) Stored procedures RBAC
-------------------------

IF OBJECT_ID('dbo.sp_permiso_upsert', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_permiso_upsert;
GO
IF OBJECT_ID('dbo.sp_rol_permiso_set', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_rol_permiso_set;
GO
IF OBJECT_ID('dbo.sp_usuario_rol_global_set', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_usuario_rol_global_set;
GO
IF OBJECT_ID('dbo.fn_authz_tiene_permiso', 'FN') IS NOT NULL DROP FUNCTION dbo.fn_authz_tiene_permiso;
GO

CREATE PROCEDURE dbo.sp_permiso_upsert
  @clave nvarchar(120),
  @nombre nvarchar(120),
  @detalle nvarchar(255) = NULL,
  @usercrea int = NULL,
  @codprm_out int OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  IF @clave IS NULL OR LTRIM(RTRIM(@clave)) = ''
    THROW 50200, N'clave es requerida.', 1;

  IF @nombre IS NULL OR LTRIM(RTRIM(@nombre)) = ''
    THROW 50201, N'nombre es requerido.', 1;

  MERGE dbo.permisos AS t
  USING (SELECT @clave AS clave_prm) AS s
    ON t.clave_prm = s.clave_prm
  WHEN MATCHED THEN
    UPDATE SET nombre_prm = @nombre,
               detalle_prm = @detalle,
               usermod = @usercrea,
               fechmod = getdate(),
               estado_prm = 'A'
  WHEN NOT MATCHED THEN
    INSERT (clave_prm, nombre_prm, detalle_prm, usercrea)
    VALUES (@clave, @nombre, @detalle, @usercrea);

  SELECT @codprm_out = codprm_prm FROM dbo.permisos WHERE clave_prm = @clave;
END;
GO

CREATE PROCEDURE dbo.sp_rol_permiso_set
  @codrol int,
  @clave_permiso nvarchar(120),
  @estado char(1) = 'A',
  @usercrea int = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @codrol IS NULL
    THROW 50210, N'codrol es requerido.', 1;

  DECLARE @codprm int;
  SELECT @codprm = codprm_prm FROM dbo.permisos WHERE clave_prm = @clave_permiso;

  IF @codprm IS NULL
    THROW 50211, N'Permiso no existe (clave_permiso).', 1;

  MERGE dbo.rol_permiso AS t
  USING (SELECT @codrol AS codrol_rpe, @codprm AS codprm_rpe) AS s
    ON t.codrol_rpe = s.codrol_rpe AND t.codprm_rpe = s.codprm_rpe
  WHEN MATCHED THEN
    UPDATE SET estado_rpe = @estado,
               usermod = @usercrea,
               fechmod = getdate()
  WHEN NOT MATCHED THEN
    INSERT (codrol_rpe, codprm_rpe, estado_rpe, usercrea)
    VALUES (@codrol, @codprm, @estado, @usercrea);
END;
GO

CREATE PROCEDURE dbo.sp_usuario_rol_global_set
  @codusr varchar(8),
  @codrol int,
  @estado char(1) = 'A',
  @usercrea int = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @codusr IS NULL OR LTRIM(RTRIM(@codusr)) = ''
    THROW 50220, N'codusr es requerido.', 1;

  IF @codrol IS NULL
    THROW 50221, N'codrol es requerido.', 1;

  IF NOT EXISTS (SELECT 1 FROM dbo.usuario WHERE codusr_usr = @codusr)
    THROW 50222, N'Usuario no existe.', 1;

  IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE codrol_rol = @codrol)
    THROW 50223, N'Rol no existe.', 1;

  MERGE dbo.usuario_rol_global AS t
  USING (SELECT @codusr AS codusr_urg, @codrol AS codrol_urg) AS s
    ON t.codusr_urg = s.codusr_urg AND t.codrol_urg = s.codrol_urg
  WHEN MATCHED THEN
    UPDATE SET estado_urg = @estado,
               usermod = @usercrea,
               fechmod = getdate()
  WHEN NOT MATCHED THEN
    INSERT (codusr_urg, codrol_urg, estado_urg, usercrea)
    VALUES (@codusr, @codrol, @estado, @usercrea);
END;
GO

-- Función de autorización (global+por negocio)
CREATE FUNCTION dbo.fn_authz_tiene_permiso (
  @codusr varchar(8),
  @codneg int = NULL,
  @clave_permiso nvarchar(120)
)
RETURNS bit
AS
BEGIN
  IF @codusr IS NULL OR @clave_permiso IS NULL
    RETURN 0;

  IF EXISTS (
    SELECT 1
    FROM dbo.usuario_permiso_global upg
    JOIN dbo.permisos p ON p.codprm_prm = upg.codprm_upg
    WHERE upg.codusr_upg = @codusr
      AND upg.estado_upg = 'A'
      AND upg.permitido_upg = 1
      AND p.estado_prm = 'A'
      AND (p.clave_prm = @clave_permiso OR p.clave_prm = N'*')
  )
    RETURN 1;

  IF EXISTS (
    SELECT 1
    FROM dbo.usuario_rol_global urg
    JOIN dbo.rol_permiso rp ON rp.codrol_rpe = urg.codrol_urg
    JOIN dbo.permisos p ON p.codprm_prm = rp.codprm_rpe
    WHERE urg.codusr_urg = @codusr
      AND urg.estado_urg = 'A'
      AND rp.estado_rpe = 'A'
      AND p.estado_prm = 'A'
      AND (p.clave_prm = @clave_permiso OR p.clave_prm = N'*')
  )
    RETURN 1;

  IF @codneg IS NULL
    RETURN 0;

  IF EXISTS (
    SELECT 1
    FROM dbo.usuario_negocio un
    JOIN dbo.rol_permiso rp ON rp.codrol_rpe = un.codrol_uneg
    JOIN dbo.permisos p ON p.codprm_prm = rp.codprm_rpe
    WHERE un.codusr_uneg = @codusr
      AND un.codneg_uneg = @codneg
      AND un.estado_uneg = 'A'
      AND rp.estado_rpe = 'A'
      AND p.estado_prm = 'A'
      AND (p.clave_prm = @clave_permiso OR p.clave_prm = N'*')
  )
    RETURN 1;

  RETURN 0;
END;
GO

-------------------------
-- 10.2) Semillas RBAC: SUPERADMIN global
-------------------------
-- Rol SUPERADMIN
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE nombre_rol = N'SUPERADMIN')
BEGIN
  INSERT INTO dbo.roles (nombre_rol, detalle_rol, usercrea)
  VALUES (N'SUPERADMIN', N'Acceso total a todos los negocios y funciones', NULL);
END
GO


DECLARE @codprm_star int;
EXEC dbo.sp_permiso_upsert @clave=N'*', @nombre=N'Todo', @detalle=N'Permiso comodín (acceso total)', @usercrea=NULL, @codprm_out=@codprm_star OUTPUT;
GO
-- Asegurar usuario admin
IF NOT EXISTS (SELECT 1 FROM dbo.usuario WHERE codusr_usr = 'admin')
BEGIN
  INSERT INTO dbo.usuario (codusr_usr,codrol_usr, nombre_usr, passwo_usr, esdueno_usr, loginmulti_usr, estado_usr, usercrea)
  VALUES ('admin',1, N'admin', N'bbc81e922d1c391478', 0, 1, 'A', NULL);
END
GO
DECLARE @codrol_sa int;
SELECT @codrol_sa = codrol_rol FROM dbo.roles WHERE nombre_rol = N'SUPERADMIN';

EXEC dbo.sp_usuario_rol_global_set
  @codusr='admin',
  @codrol=@codrol_sa,
  @estado='A',
  @usercrea=NULL;
GO

