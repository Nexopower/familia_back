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

CREATE TABLE dbo.tipos_negocio (
  codtng_tng int IDENTITY(1,1) NOT NULL,
  nombre_tng nvarchar(50) NOT NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_tipos_negocio_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_tipos_negocio_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_tipos_negocio PRIMARY KEY (codtng_tng),
  CONSTRAINT UQ_tipos_negocio_nombre UNIQUE (nombre_tng)
);
GO

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

CREATE TABLE dbo.configuracion_sistema (
  codcfs_cfs int IDENTITY(1,1) NOT NULL,
  parametros_cfs nvarchar(max) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_configuracion_sistema_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_configuracion_sistema_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_configuracion_sistema PRIMARY KEY (codcfs_cfs)
);
GO

CREATE TABLE dbo.configuracion_negocio (
  codcfn_cfn int IDENTITY(1,1) NOT NULL,
  parametros_cfn nvarchar(max) NULL,
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_configuracion_negocio_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_configuracion_negocio_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_configuracion_negocio PRIMARY KEY (codcfn_cfn)
);
GO

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
  codtng_neg int NOT NULL,
  codper_neg int NOT NULL,
  codcfn_neg int NULL,
  estado_neg char(1) NOT NULL CONSTRAINT DF_negocios_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_negocios_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_negocios_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_negocios PRIMARY KEY (codneg_neg),
  CONSTRAINT UQ_negocios_duenio_nombre UNIQUE (codper_neg, nombre_neg)
);
GO

CREATE TABLE dbo.usuario (
  codusr_usr varchar(8) NOT NULL,
  codper_usr int NULL,
  codpad_usr varchar(8) NULL,
  codrol_usr int NULL,
  nombre_usr nvarchar(255) NULL,
  passwo_usr nvarchar(255) NULL,
  codneg_usr int NULL,
  estado_usr char(1) NOT NULL CONSTRAINT DF_usuario_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_usuario_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_usuario_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_usuario PRIMARY KEY (codusr_usr),
  CONSTRAINT UQ_usuario_negocio_nombre UNIQUE (codneg_usr, nombre_usr)
);
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
  estado_prd char(1) NOT NULL CONSTRAINT DF_producto_estado DEFAULT ('A'),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_producto_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_producto_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_producto PRIMARY KEY (codprd_prd),
  CONSTRAINT UQ_producto_negocio_codigo UNIQUE (codneg_prd, codigo_prd)
);
GO

CREATE TABLE dbo.producto_det (
  codpdt_pdt int IDENTITY(1,1) NOT NULL,
  codprd_pdt int NOT NULL,
  precio_pdt decimal(18, 2) NOT NULL CONSTRAINT DF_producto_det_precio DEFAULT (0),
  existencia_pdt int NOT NULL CONSTRAINT DF_producto_det_existencia DEFAULT (0),
  usercrea int NULL,
  usermod int NULL,
  fechcrea datetime NULL CONSTRAINT DF_producto_det_fechcrea DEFAULT (getdate()),
  fechmod datetime NULL CONSTRAINT DF_producto_det_fechmod DEFAULT (getdate()),
  CONSTRAINT PK_producto_det PRIMARY KEY (codpdt_pdt)
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
-- 8) Relaciones (FKs)
-------------------------

ALTER TABLE dbo.personas
  ADD CONSTRAINT FK_personas_sexo FOREIGN KEY (codsex_per) REFERENCES dbo.sexo(codsex_sex);
GO

ALTER TABLE dbo.negocios
  ADD CONSTRAINT FK_negocios_tipo FOREIGN KEY (codtng_neg) REFERENCES dbo.tipos_negocio(codtng_tng);
GO

ALTER TABLE dbo.negocios
  ADD CONSTRAINT FK_negocios_duenio FOREIGN KEY (codper_neg) REFERENCES dbo.personas(codper_per);
GO

ALTER TABLE dbo.negocios
  ADD CONSTRAINT FK_negocios_config FOREIGN KEY (codcfn_neg) REFERENCES dbo.configuracion_negocio(codcfn_cfn);
GO

ALTER TABLE dbo.usuario
  ADD CONSTRAINT FK_usuario_persona FOREIGN KEY (codper_usr) REFERENCES dbo.personas(codper_per);
GO

ALTER TABLE dbo.usuario
  ADD CONSTRAINT FK_usuario_rol FOREIGN KEY (codrol_usr) REFERENCES dbo.roles(codrol_rol);
GO

ALTER TABLE dbo.usuario
  ADD CONSTRAINT FK_usuario_negocio FOREIGN KEY (codneg_usr) REFERENCES dbo.negocios(codneg_neg);
GO

ALTER TABLE dbo.usuario
  ADD CONSTRAINT FK_usuario_padre FOREIGN KEY (codpad_usr) REFERENCES dbo.usuario(codusr_usr);
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

------------------------------------------------------------
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
-- 9.3) Triggers
-------------------------

-- Mantiene subtotal_fdt = cantidad_fdt * preuni_fdt
CREATE TRIGGER dbo.TR_factura_detalle_subtotal
ON dbo.factura_detalle
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE fd
    SET subtotal_fdt = CAST(fd.cantidad_fdt * fd.preuni_fdt AS decimal(18,2)),
        fechmod = getdate()
  FROM dbo.factura_detalle fd
  INNER JOIN inserted i ON i.codfdt_fdt = fd.codfdt_fdt;
END;
GO

-- Recalcula total_fac cuando cambia el detalle
CREATE TRIGGER dbo.TR_factura_detalle_recalcular_total
ON dbo.factura_detalle
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;

  ;WITH f AS (
    SELECT codfac_fdt AS codfac
    FROM inserted
    UNION
    SELECT codfac_fdt
    FROM deleted
  )
  UPDATE fa
    SET total_fac = ISNULL(x.total, 0),
        fechmod = getdate()
  FROM dbo.facturas fa
  INNER JOIN (SELECT DISTINCT codfac FROM f) z ON z.codfac = fa.codfac_fac
  OUTER APPLY (
    SELECT SUM(fd.subtotal_fdt) AS total
    FROM dbo.factura_detalle fd
    WHERE fd.codfac_fdt = fa.codfac_fac
  ) x;
END;
GO

-- Valida que codcli_fac/codpro_fac correspondan al tipo_fac
CREATE TRIGGER dbo.TR_facturas_validar_contraparte
ON dbo.facturas
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (
    SELECT 1
    FROM inserted i
    WHERE (i.tipo_fac = 'venta' AND (i.codcli_fac IS NULL OR i.codpro_fac IS NOT NULL))
       OR (i.tipo_fac = 'compra' AND (i.codpro_fac IS NULL OR i.codcli_fac IS NOT NULL))
       OR (i.tipo_fac NOT IN ('venta', 'compra'))
  )
  BEGIN
    THROW 50001, N'Factura inválida: tipo_fac debe ser venta/compra y requiere cliente/proveedor según corresponda.', 1;
  END
END;
GO

-- Aplica el impacto de movimientos al stock del inventario
CREATE TRIGGER dbo.TR_movimientos_inventario_aplicar_stock
ON dbo.movimientos_inventario
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;

  -- Normaliza cambios como deltas (UPDATE/DELETE revierten)
  ;WITH cambios AS (
    SELECT i.codinv_min AS codinv,
           CASE
             WHEN i.tipo_min = 'entrada' THEN i.cantidad_min
             WHEN i.tipo_min = 'salida' THEN -i.cantidad_min
             WHEN i.tipo_min = 'ajuste' THEN i.cantidad_min
             ELSE 0
           END AS delta
    FROM inserted i

    UNION ALL

    SELECT d.codinv_min,
           -CASE
             WHEN d.tipo_min = 'entrada' THEN d.cantidad_min
             WHEN d.tipo_min = 'salida' THEN -d.cantidad_min
             WHEN d.tipo_min = 'ajuste' THEN d.cantidad_min
             ELSE 0
           END
    FROM deleted d
  ),
  agg AS (
    SELECT codinv, SUM(delta) AS delta
    FROM cambios
    GROUP BY codinv
  )
  UPDATE inv
    SET inv.stock_inv = inv.stock_inv + a.delta,
        inv.fechmod = getdate()
  FROM dbo.inventario inv
  INNER JOIN agg a ON a.codinv = inv.codinv_inv;

  IF EXISTS (SELECT 1 FROM dbo.inventario WHERE stock_inv < 0)
  BEGIN
    THROW 50002, N'Operación inválida: el stock no puede quedar negativo.', 1;
  END
END;
GO

-- Refuerzo de no solape en reservas (si insertan/actualizan sin SP)
CREATE TRIGGER dbo.TR_reservas_validar_solape
ON dbo.reservas
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (
    SELECT 1
    FROM inserted i
    WHERE i.fecini_res >= i.fecfin_res
  )
  BEGIN
    THROW 50003, N'Reserva inválida: fecini_res debe ser menor que fecfin_res.', 1;
  END

  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN dbo.reservas r
      ON r.codneg_res = i.codneg_res
     AND r.estado_res <> 'cancelada'
     AND r.codres_res <> i.codres_res
     AND r.fecini_res < i.fecfin_res
     AND r.fecfin_res > i.fecini_res
    WHERE i.estado_res <> 'cancelada'
  )
  BEGIN
    THROW 50004, N'Reserva inválida: existe solape de fechas para el negocio.', 1;
  END
END;
GO

-- FIN: lógica en BD
