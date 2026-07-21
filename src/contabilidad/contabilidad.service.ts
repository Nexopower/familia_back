import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

interface MovimientoDto {
  codneg: number;
  codcta: number;
  monto: number;
  descri?: string;
  refdoc?: string;
  codusr?: string;
  usercrea?: number;
}

@Injectable()
export class ContabilidadService {
  constructor(private readonly sql: SqlService) {}

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación.'
    );
  }

  async listarCuentas(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');

    try {
      const query = `
        SELECT
          c.codcta_cta AS codcta,
          c.nombre_cta AS nombre,
          c.tipo_cta AS tipo,
          c.codneg_cta AS codneg,
          c.estado_cta AS estado
        FROM dbo.cuentas_contables c
        WHERE c.estado_cta = 'A'
          AND (c.codneg_cta = @codneg OR c.codneg_cta IS NULL)
        ORDER BY c.nombre_cta;
      `;

      return await this.sql.executeQueryParams(query, { codneg });
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async crearCuenta(dto: {
    codneg: number;
    nombre: string;
    tipo?: string | null;
    usercrea?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    if (!dto.nombre?.trim())
      throw new BadRequestException('El nombre de la cuenta es requerido');

    try {
      const query = `
        INSERT INTO dbo.cuentas_contables (nombre_cta, tipo_cta, codneg_cta, estado_cta, usercrea)
        OUTPUT
          INSERTED.codcta_cta AS codcta,
          INSERTED.nombre_cta AS nombre,
          INSERTED.tipo_cta AS tipo,
          INSERTED.codneg_cta AS codneg,
          INSERTED.estado_cta AS estado
        VALUES (@nombre, @tipo, @codneg, 'A', @usercrea);
      `;

      const rows = await this.sql.executeQueryParams(query, {
        nombre: dto.nombre.trim(),
        tipo: dto.tipo?.trim() || 'general',
        codneg: dto.codneg,
        usercrea: dto.usercrea ?? null,
      });

      return rows?.[0] ?? { ok: true };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /**
   * Configuración de contabilización automática: a qué cuenta va cada
   * concepto ('venta' | 'compra' | 'default') al cerrar facturas.
   */
  async obtenerConfig(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    try {
      const query = `
        SELECT
          cfg.concepto_cfg AS concepto,
          cfg.codcta_cfg AS codcta,
          cc.nombre_cta AS cuenta_nombre
        FROM dbo.contabilidad_config cfg
        INNER JOIN dbo.cuentas_contables cc ON cc.codcta_cta = cfg.codcta_cfg
        WHERE cfg.codneg_cfg = @codneg;
      `;
      const rows = await this.sql.executeQueryParams(query, { codneg });
      const map: Record<string, { codcta: number; cuenta_nombre: string }> = {};
      for (const r of rows ?? []) {
        map[r.concepto] = { codcta: r.codcta, cuenta_nombre: r.cuenta_nombre };
      }
      return {
        venta: map['venta'] ?? null,
        compra: map['compra'] ?? null,
        default: map['default'] ?? null,
      };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async guardarConfig(dto: {
    codneg: number;
    concepto: string;
    codcta: number | null;
    usermod?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    const concepto = String(dto.concepto ?? '').toLowerCase();
    if (!['venta', 'compra', 'default'].includes(concepto)) {
      throw new BadRequestException("concepto debe ser 'venta', 'compra' o 'default'");
    }

    try {
      // codcta null => quitar la asignación (volver al default automático)
      if (dto.codcta === null || dto.codcta === undefined) {
        await this.sql.executeQueryParams(
          `DELETE FROM dbo.contabilidad_config WHERE codneg_cfg = @codneg AND concepto_cfg = @concepto;`,
          { codneg: dto.codneg, concepto },
        );
        return { ok: true };
      }

      const query = `
        IF EXISTS (SELECT 1 FROM dbo.contabilidad_config WHERE codneg_cfg = @codneg AND concepto_cfg = @concepto)
          UPDATE dbo.contabilidad_config
            SET codcta_cfg = @codcta, usermod = @usermod, fechmod = getdate()
          WHERE codneg_cfg = @codneg AND concepto_cfg = @concepto;
        ELSE
          INSERT INTO dbo.contabilidad_config (codneg_cfg, concepto_cfg, codcta_cfg, usermod)
          VALUES (@codneg, @concepto, @codcta, @usermod);
      `;
      await this.sql.executeQueryParams(query, {
        codneg: dto.codneg,
        concepto,
        codcta: dto.codcta,
        usermod: dto.usermod ?? null,
      });
      return { ok: true };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /** Gasto por proveedor (compras cerradas) en un período. */
  async reporteProveedores(dto: { codneg: number; desde?: Date | null; hasta?: Date | null }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    return await this.sql.executeQueryParams(
      `
      SELECT
        f.codpro_fac AS codpro,
        COALESCE(pr.nombre_pro, CONCAT(p.nombre_per, ' ', ISNULL(p.apellidos_per, '')), 'Proveedor general') AS proveedor,
        COUNT(*) AS facturas,
        SUM(f.total_fac) AS total,
        MIN(f.fecha_fac) AS primera,
        MAX(f.fecha_fac) AS ultima
      FROM dbo.facturas f
      LEFT JOIN dbo.proveedores pr ON pr.codpro_pro = f.codpro_fac
      LEFT JOIN dbo.personas p ON p.codper_per = pr.codper_pro
      WHERE f.codneg_fac = @codneg AND f.tipo_fac = 'compra' AND f.estado_fac = 'cerrada'
        AND (@desde IS NULL OR f.fecha_fac >= @desde)
        AND (@hasta IS NULL OR f.fecha_fac < DATEADD(DAY, 1, @hasta))
      GROUP BY f.codpro_fac, pr.nombre_pro, p.nombre_per, p.apellidos_per
      ORDER BY total DESC;
      `,
      { codneg: dto.codneg, desde: dto.desde ?? null, hasta: dto.hasta ?? null },
    );
  }

  /** Compras por cliente (ventas cerradas) en un período, con desglose fiado. */
  async reporteClientes(dto: { codneg: number; desde?: Date | null; hasta?: Date | null }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    return await this.sql.executeQueryParams(
      `
      SELECT
        f.codcli_fac AS codcli,
        COALESCE(CONCAT(p.nombre_per, ' ', ISNULL(p.apellidos_per, '')), 'Consumidor final') AS cliente,
        COUNT(*) AS facturas,
        SUM(f.total_fac) AS total,
        SUM(CASE WHEN f.fiada_fac = 1 THEN f.total_fac ELSE 0 END) AS total_fiado,
        MAX(f.fecha_fac) AS ultima
      FROM dbo.facturas f
      LEFT JOIN dbo.clientes c ON c.codcli_cli = f.codcli_fac
      LEFT JOIN dbo.personas p ON p.codper_per = c.codper_cli
      WHERE f.codneg_fac = @codneg AND f.tipo_fac = 'venta' AND f.estado_fac = 'cerrada'
        AND (@desde IS NULL OR f.fecha_fac >= @desde)
        AND (@hasta IS NULL OR f.fecha_fac < DATEADD(DAY, 1, @hasta))
      GROUP BY f.codcli_fac, p.nombre_per, p.apellidos_per
      ORDER BY total DESC;
      `,
      { codneg: dto.codneg, desde: dto.desde ?? null, hasta: dto.hasta ?? null },
    );
  }

  /**
   * Desglose de ventas por método/origen en un período:
   * efectivo (contado), fiado, abonos de fiao recibidos.
   * (Categoría "fondo" se sumará cuando exista el módulo de fondos.)
   */
  async ventasDesglose(dto: { codneg: number; desde?: Date | null; hasta?: Date | null }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    const rows = await this.sql.executeQueryParams(
      `
      SELECT
        (SELECT ISNULL(SUM(f.total_fac), 0) FROM dbo.facturas f
          WHERE f.codneg_fac = @codneg AND f.tipo_fac = 'venta' AND f.estado_fac = 'cerrada' AND f.fiada_fac = 0
            AND (@desde IS NULL OR f.fecha_fac >= @desde)
            AND (@hasta IS NULL OR f.fecha_fac < DATEADD(DAY, 1, @hasta))) AS ventas_contado,
        (SELECT ISNULL(SUM(f.total_fac), 0) FROM dbo.facturas f
          WHERE f.codneg_fac = @codneg AND f.tipo_fac = 'venta' AND f.estado_fac = 'cerrada' AND f.fiada_fac = 1
            AND (@desde IS NULL OR f.fecha_fac >= @desde)
            AND (@hasta IS NULL OR f.fecha_fac < DATEADD(DAY, 1, @hasta))) AS ventas_fiadas,
        (SELECT ISNULL(SUM(a.monto_abo), 0)
           FROM dbo.fiao_abonos a
           INNER JOIN dbo.fiaos fi ON fi.codfia = a.codfia_abo
          WHERE fi.codneg_fia = @codneg
            AND (@desde IS NULL OR a.fechcrea >= @desde)
            AND (@hasta IS NULL OR a.fechcrea < DATEADD(DAY, 1, @hasta))) AS abonos_fiao,
        (SELECT ISNULL(SUM(f.saldo_fia), 0) FROM dbo.fiaos f
          WHERE f.codneg_fia = @codneg AND f.estado_fia <> 'pagado') AS fiao_pendiente_total,
        (SELECT ISNULL(SUM(m.monto_fmv), 0)
           FROM dbo.fondo_movimientos m
           INNER JOIN dbo.cliente_fondo cf ON cf.codfon = m.codfon_fmv
          WHERE cf.codneg_fon = @codneg AND m.tipo_fmv IN ('consumo','adelanto')
            AND (@desde IS NULL OR m.fechcrea >= @desde)
            AND (@hasta IS NULL OR m.fechcrea < DATEADD(DAY, 1, @hasta))) AS ventas_fondo;
      `,
      { codneg: dto.codneg, desde: dto.desde ?? null, hasta: dto.hasta ?? null },
    );
    const r = rows?.[0] ?? {};
    return {
      ventas_contado: Number(r.ventas_contado ?? 0),
      ventas_fiadas: Number(r.ventas_fiadas ?? 0),
      // Parte de las ventas del período pagada con fondos (incluida en el
      // total: es desglose informativo, no una categoría aparte del ingreso).
      ventas_fondo: Number(r.ventas_fondo ?? 0),
      abonos_fiao: Number(r.abonos_fiao ?? 0),
      fiao_pendiente_total: Number(r.fiao_pendiente_total ?? 0),
      ventas_total: Number(r.ventas_contado ?? 0) + Number(r.ventas_fiadas ?? 0),
    };
  }

  /**
   * Cierre de caja de un día: ventas y compras cerradas, efectivo recibido,
   * balance y facturas que siguen abiertas (pendientes de cerrar/contabilizar).
   */
  async cierreCaja(dto: { codneg: number; fecha?: Date | null }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    const fecha = dto.fecha ?? new Date();

    try {
      const query = `
        SELECT
          SUM(CASE WHEN tipo_fac = 'venta'  AND estado_fac = 'cerrada' AND fiada_fac = 0 THEN total_fac ELSE 0 END) AS ventas_total,
          SUM(CASE WHEN tipo_fac = 'venta'  AND estado_fac = 'cerrada' AND fiada_fac = 0 THEN 1 ELSE 0 END)         AS ventas_cant,
          SUM(CASE WHEN tipo_fac = 'venta'  AND estado_fac = 'cerrada' AND fiada_fac = 1 THEN total_fac ELSE 0 END) AS fiado_total,
          SUM(CASE WHEN tipo_fac = 'venta'  AND estado_fac = 'cerrada' AND fiada_fac = 1 THEN 1 ELSE 0 END)         AS fiado_cant,
          SUM(CASE WHEN tipo_fac = 'compra' AND estado_fac = 'cerrada' THEN total_fac ELSE 0 END) AS compras_total,
          SUM(CASE WHEN tipo_fac = 'compra' AND estado_fac = 'cerrada' THEN 1 ELSE 0 END)         AS compras_cant,
          SUM(CASE WHEN tipo_fac = 'venta'  AND estado_fac = 'cerrada' AND fiada_fac = 0 THEN ISNULL(efectivo_fac, 0) ELSE 0 END) AS efectivo_ventas,
          SUM(CASE WHEN tipo_fac = 'venta'  AND estado_fac = 'abierta' THEN 1 ELSE 0 END)         AS abiertas_venta_cant,
          SUM(CASE WHEN tipo_fac = 'venta'  AND estado_fac = 'abierta' THEN total_fac ELSE 0 END) AS abiertas_venta_total,
          SUM(CASE WHEN tipo_fac = 'compra' AND estado_fac = 'abierta' THEN 1 ELSE 0 END)         AS abiertas_compra_cant,
          SUM(CASE WHEN tipo_fac = 'compra' AND estado_fac = 'abierta' THEN total_fac ELSE 0 END) AS abiertas_compra_total
        FROM dbo.facturas
        WHERE codneg_fac = @codneg
          AND fecha_fac >= @fecha
          AND fecha_fac < DATEADD(DAY, 1, @fecha);
      `;
      const rows = await this.sql.executeQueryParams(query, {
        codneg: dto.codneg,
        fecha,
      });
      const r = rows?.[0] ?? {};

      const abonosRows = await this.sql.executeQueryParams(
        `SELECT ISNULL(SUM(a.monto_abo), 0) AS abonos_fiao
         FROM dbo.fiao_abonos a
         INNER JOIN dbo.fiaos fi ON fi.codfia = a.codfia_abo
         WHERE fi.codneg_fia = @codneg
           AND a.fechcrea >= @fecha
           AND a.fechcrea < DATEADD(DAY, 1, @fecha);`,
        { codneg: dto.codneg, fecha },
      );
      const abonosFiao = Number(abonosRows?.[0]?.abonos_fiao ?? 0);

      // Consumo vía fondos del día (informativo: ya está dentro de las ventas).
      const fondoRows = await this.sql.executeQueryParams(
        `SELECT ISNULL(SUM(m.monto_fmv), 0) AS fondo_total
         FROM dbo.fondo_movimientos m
         INNER JOIN dbo.cliente_fondo cf ON cf.codfon = m.codfon_fmv
         WHERE cf.codneg_fon = @codneg AND m.tipo_fmv IN ('consumo','adelanto')
           AND m.fechcrea >= @fecha AND m.fechcrea < DATEADD(DAY, 1, @fecha);`,
        { codneg: dto.codneg, fecha },
      );
      const fondoTotal = Number(fondoRows?.[0]?.fondo_total ?? 0);

      const ventasTotal = Number(r.ventas_total ?? 0);
      const comprasTotal = Number(r.compras_total ?? 0);
      return {
        fecha: this.toDateOnly(fecha),
        ventas_total: ventasTotal,
        ventas_cant: Number(r.ventas_cant ?? 0),
        // Fiado del día: NO suma al efectivo (deuda del cliente).
        fiado_total: Number(r.fiado_total ?? 0),
        fiado_cant: Number(r.fiado_cant ?? 0),
        // Abonos de fiao cobrados hoy: SÍ son efectivo del día.
        abonos_fiao: abonosFiao,
        // Consumido vía fondos hoy (informativo: incluido en ventas).
        fondo_total: fondoTotal,
        compras_total: comprasTotal,
        compras_cant: Number(r.compras_cant ?? 0),
        efectivo_ventas: Number(r.efectivo_ventas ?? 0),
        balance: ventasTotal + abonosFiao - comprasTotal,
        abiertas_venta_cant: Number(r.abiertas_venta_cant ?? 0),
        abiertas_venta_total: Number(r.abiertas_venta_total ?? 0),
        abiertas_compra_cant: Number(r.abiertas_compra_cant ?? 0),
        abiertas_compra_total: Number(r.abiertas_compra_total ?? 0),
      };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  private toDateOnly(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Resumen contable de un período: totales de ingresos, egresos, balance
   * y desglose por cuenta. Alimenta el dashboard de la vista.
   */
  async resumen(dto: {
    codneg: number;
    desde?: Date | null;
    hasta?: Date | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');

    try {
      const params = {
        codneg: dto.codneg,
        desde: dto.desde ?? null,
        hasta: dto.hasta ?? null,
      };

      // Totales globales
      const totalesQuery = `
        SELECT
          (SELECT ISNULL(SUM(i.monto_ing), 0)
             FROM dbo.ingresos i
            WHERE i.codneg_ing = @codneg
              AND (@desde IS NULL OR i.fecha_ing >= @desde)
              AND (@hasta IS NULL OR i.fecha_ing < DATEADD(DAY, 1, @hasta))) AS total_ingresos,
          (SELECT COUNT(*)
             FROM dbo.ingresos i
            WHERE i.codneg_ing = @codneg
              AND (@desde IS NULL OR i.fecha_ing >= @desde)
              AND (@hasta IS NULL OR i.fecha_ing < DATEADD(DAY, 1, @hasta))) AS num_ingresos,
          (SELECT ISNULL(SUM(e.monto_egr), 0)
             FROM dbo.egresos e
            WHERE e.codneg_egr = @codneg
              AND (@desde IS NULL OR e.fecha_egr >= @desde)
              AND (@hasta IS NULL OR e.fecha_egr < DATEADD(DAY, 1, @hasta))) AS total_egresos,
          (SELECT COUNT(*)
             FROM dbo.egresos e
            WHERE e.codneg_egr = @codneg
              AND (@desde IS NULL OR e.fecha_egr >= @desde)
              AND (@hasta IS NULL OR e.fecha_egr < DATEADD(DAY, 1, @hasta))) AS num_egresos;
      `;

      // Desglose por cuenta (ingresos y egresos unidos)
      const porCuentaQuery = `
        SELECT
          c.codcta_cta AS codcta,
          c.nombre_cta AS cuenta_nombre,
          c.tipo_cta AS cuenta_tipo,
          ISNULL(SUM(m.ingreso), 0) AS total_ingresos,
          ISNULL(SUM(m.egreso), 0) AS total_egresos,
          ISNULL(SUM(m.ingreso), 0) - ISNULL(SUM(m.egreso), 0) AS balance,
          COUNT(*) AS movimientos
        FROM (
          SELECT i.codcta_ing AS codcta, i.monto_ing AS ingreso, 0 AS egreso
            FROM dbo.ingresos i
           WHERE i.codneg_ing = @codneg
             AND (@desde IS NULL OR i.fecha_ing >= @desde)
             AND (@hasta IS NULL OR i.fecha_ing < DATEADD(DAY, 1, @hasta))
          UNION ALL
          SELECT e.codcta_egr AS codcta, 0 AS ingreso, e.monto_egr AS egreso
            FROM dbo.egresos e
           WHERE e.codneg_egr = @codneg
             AND (@desde IS NULL OR e.fecha_egr >= @desde)
             AND (@hasta IS NULL OR e.fecha_egr < DATEADD(DAY, 1, @hasta))
        ) m
        INNER JOIN dbo.cuentas_contables c ON c.codcta_cta = m.codcta
        GROUP BY c.codcta_cta, c.nombre_cta, c.tipo_cta
        ORDER BY balance DESC;
      `;

      // Serie diaria para tendencia (últimos movimientos del período)
      const porDiaQuery = `
        SELECT
          dia,
          ISNULL(SUM(ingreso), 0) AS total_ingresos,
          ISNULL(SUM(egreso), 0) AS total_egresos
        FROM (
          SELECT CAST(i.fecha_ing AS DATE) AS dia, i.monto_ing AS ingreso, 0 AS egreso
            FROM dbo.ingresos i
           WHERE i.codneg_ing = @codneg
             AND (@desde IS NULL OR i.fecha_ing >= @desde)
             AND (@hasta IS NULL OR i.fecha_ing < DATEADD(DAY, 1, @hasta))
          UNION ALL
          SELECT CAST(e.fecha_egr AS DATE) AS dia, 0 AS ingreso, e.monto_egr AS egreso
            FROM dbo.egresos e
           WHERE e.codneg_egr = @codneg
             AND (@desde IS NULL OR e.fecha_egr >= @desde)
             AND (@hasta IS NULL OR e.fecha_egr < DATEADD(DAY, 1, @hasta))
        ) m
        GROUP BY dia
        ORDER BY dia;
      `;

      const [totalesRows, porCuenta, porDia] = await Promise.all([
        this.sql.executeQueryParams(totalesQuery, params),
        this.sql.executeQueryParams(porCuentaQuery, params),
        this.sql.executeQueryParams(porDiaQuery, params),
      ]);

      const t = totalesRows?.[0] ?? {};
      const totalIngresos = Number(t.total_ingresos ?? 0);
      const totalEgresos = Number(t.total_egresos ?? 0);

      return {
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance: totalIngresos - totalEgresos,
        num_ingresos: Number(t.num_ingresos ?? 0),
        num_egresos: Number(t.num_egresos ?? 0),
        por_cuenta: porCuenta ?? [],
        por_dia: porDia ?? [],
      };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async listarIngresos(dto: {
    codneg: number;
    codcta?: number | null;
    desde?: Date | null;
    hasta?: Date | null;
    limit?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    const limit = Math.min(Math.max(Number(dto.limit ?? 100), 1), 500);

    try {
      const query = `
        SELECT TOP (@limit)
          i.coding_ing AS coding,
          i.codneg_ing AS codneg,
          i.codcta_ing AS codcta,
          c.nombre_cta AS cuenta_nombre,
          c.tipo_cta AS cuenta_tipo,
          i.monto_ing AS monto,
          i.fecha_ing AS fecha,
          i.descri_ing AS detalle,
          i.refdoc_ing AS refdoc,
          i.codusr_ing AS codusr
        FROM dbo.ingresos i
        INNER JOIN dbo.cuentas_contables c ON c.codcta_cta = i.codcta_ing
        WHERE i.codneg_ing = @codneg
          AND (@codcta IS NULL OR i.codcta_ing = @codcta)
          AND (@desde IS NULL OR i.fecha_ing >= @desde)
          AND (@hasta IS NULL OR i.fecha_ing < DATEADD(DAY, 1, @hasta))
        ORDER BY i.fecha_ing DESC, i.coding_ing DESC;
      `;

      return await this.sql.executeQueryParams(query, {
        codneg: dto.codneg,
        codcta: dto.codcta ?? null,
        desde: dto.desde ?? null,
        hasta: dto.hasta ?? null,
        limit,
      });
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async listarEgresos(dto: {
    codneg: number;
    codcta?: number | null;
    desde?: Date | null;
    hasta?: Date | null;
    limit?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    const limit = Math.min(Math.max(Number(dto.limit ?? 100), 1), 500);

    try {
      const query = `
        SELECT TOP (@limit)
          e.codegr_egr AS codegr,
          e.codneg_egr AS codneg,
          e.codcta_egr AS codcta,
          c.nombre_cta AS cuenta_nombre,
          c.tipo_cta AS cuenta_tipo,
          e.monto_egr AS monto,
          e.fecha_egr AS fecha,
          e.descri_egr AS detalle,
          e.refdoc_egr AS refdoc,
          e.codusr_egr AS codusr
        FROM dbo.egresos e
        INNER JOIN dbo.cuentas_contables c ON c.codcta_cta = e.codcta_egr
        WHERE e.codneg_egr = @codneg
          AND (@codcta IS NULL OR e.codcta_egr = @codcta)
          AND (@desde IS NULL OR e.fecha_egr >= @desde)
          AND (@hasta IS NULL OR e.fecha_egr < DATEADD(DAY, 1, @hasta))
        ORDER BY e.fecha_egr DESC, e.codegr_egr DESC;
      `;

      return await this.sql.executeQueryParams(query, {
        codneg: dto.codneg,
        codcta: dto.codcta ?? null,
        desde: dto.desde ?? null,
        hasta: dto.hasta ?? null,
        limit,
      });
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async registrarIngreso(dto: MovimientoDto) {
    if (!dto.codneg || !dto.codcta || !dto.monto) {
      throw new BadRequestException('codneg, codcta y monto son requeridos');
    }

    try {
      const query = `
                DECLARE @coding_out INT;
                EXEC dbo.sp_ingreso_registrar
                    @codneg = @codneg,
                    @codcta = @codcta,
                    @monto = @monto,
                    @descri = @descri,
                    @refdoc = @refdoc,
                    @codusr = @codusr,
                    @usercrea = @usercrea,
                    @coding_out = @coding_out OUTPUT;
                SELECT @coding_out AS coding;
            `;

      const rows = await this.sql.executeQueryParams(query, {
        codneg: dto.codneg,
        codcta: dto.codcta,
        monto: dto.monto,
        descri: dto.descri ?? null,
        refdoc: dto.refdoc ?? null,
        codusr: dto.codusr ?? null,
        usercrea: dto.usercrea ?? null,
      });

      const coding = rows?.[0]?.coding;
      if (!coding) {
        throw new BadRequestException('No se pudo registrar el ingreso');
      }

      return { coding };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async registrarEgreso(dto: MovimientoDto) {
    if (!dto.codneg || !dto.codcta || !dto.monto) {
      throw new BadRequestException('codneg, codcta y monto son requeridos');
    }

    try {
      const query = `
                DECLARE @codegr_out INT;
                EXEC dbo.sp_egreso_registrar
                    @codneg = @codneg,
                    @codcta = @codcta,
                    @monto = @monto,
                    @descri = @descri,
                    @refdoc = @refdoc,
                    @codusr = @codusr,
                    @usercrea = @usercrea,
                    @codegr_out = @codegr_out OUTPUT;
                SELECT @codegr_out AS codegr;
            `;

      const rows = await this.sql.executeQueryParams(query, {
        codneg: dto.codneg,
        codcta: dto.codcta,
        monto: dto.monto,
        descri: dto.descri ?? null,
        refdoc: dto.refdoc ?? null,
        codusr: dto.codusr ?? null,
        usercrea: dto.usercrea ?? null,
      });

      const codegr = rows?.[0]?.codegr;
      if (!codegr) {
        throw new BadRequestException('No se pudo registrar el egreso');
      }

      return { codegr };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }
}
