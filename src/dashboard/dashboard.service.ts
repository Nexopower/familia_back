import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';
import { AuthService } from 'src/auth/auth.service';
import type { JwtPayload } from 'src/auth/auth.types';

@Injectable()
export class DashboardService {
  constructor(
    private readonly sql: SqlService,
    private readonly authService: AuthService,
  ) {}

  async overview(payload: JwtPayload | undefined) {
    const codusr = String(payload?.sub ?? '');
    if (!codusr) {
      throw new ForbiddenException('Token inválido');
    }

    const esSuperAdmin = await this.authService.isSuperAdmin(codusr);

    if (!esSuperAdmin) {
      const flags = await this.authService.getUserFlags(codusr);
      const canViewGeneral = flags?.esdueno || flags?.loginmulti;
      if (!canViewGeneral) {
        throw new ForbiddenException('No tiene acceso a vista general');
      }
    }

    const queryAdmin = `
      WITH neg AS (
        SELECT n.codneg_neg, n.nombre_neg
        FROM dbo.negocios n
        WHERE n.estado_neg = 'A'
      )
      SELECT
        neg.codneg_neg AS codneg,
        neg.nombre_neg AS nombre,
        (SELECT COUNT(1) FROM dbo.producto p WHERE p.codneg_prd = neg.codneg_neg AND p.estado_prd = 'A') AS productos_activos,
        (SELECT ISNULL(SUM(i.stock_inv), 0) FROM dbo.inventario i WHERE i.codneg_inv = neg.codneg_neg) AS stock_total,
        (SELECT COUNT(1) FROM dbo.facturas f WHERE f.codneg_fac = neg.codneg_neg AND f.fecha_fac >= DATEADD(DAY, -30, GETDATE())) AS facturas_30d,
        (SELECT COUNT(1) FROM dbo.facturas f WHERE f.codneg_fac = neg.codneg_neg AND f.estado_fac = 'abierta') AS facturas_abiertas,
        (SELECT COUNT(1) FROM dbo.reservas r WHERE r.codneg_res = neg.codneg_neg AND r.fecini_res >= GETDATE() AND r.fecini_res < DATEADD(DAY, 7, GETDATE()) AND r.estado_res <> 'cancelada') AS reservas_7d,
        (SELECT ISNULL(SUM(ing.monto_ing), 0) FROM dbo.ingresos ing WHERE ing.codneg_ing = neg.codneg_neg AND ing.fecha_ing >= DATEADD(DAY, -30, GETDATE())) AS ingresos_30d,
        (SELECT ISNULL(SUM(egr.monto_egr), 0) FROM dbo.egresos egr WHERE egr.codneg_egr = neg.codneg_neg AND egr.fecha_egr >= DATEADD(DAY, -30, GETDATE())) AS egresos_30d
      FROM neg
      ORDER BY neg.nombre_neg;
    `;

    const queryUser = `
      WITH neg AS (
        SELECT n.codneg_neg, n.nombre_neg
        FROM dbo.negocios n
        INNER JOIN (
          SELECT un.codneg_uneg AS codneg
          FROM dbo.usuario_negocio un
          WHERE un.codusr_uneg = @codusr AND un.estado_uneg = 'A'
          UNION
          SELECT nd.codneg_ndu AS codneg
          FROM dbo.negocio_dueno nd
          WHERE nd.codusr_ndu = @codusr AND nd.estado_ndu = 'A'
        ) a ON a.codneg = n.codneg_neg
        WHERE n.estado_neg = 'A'
      )
      SELECT
        neg.codneg_neg AS codneg,
        neg.nombre_neg AS nombre,
        (SELECT COUNT(1) FROM dbo.producto p WHERE p.codneg_prd = neg.codneg_neg AND p.estado_prd = 'A') AS productos_activos,
        (SELECT ISNULL(SUM(i.stock_inv), 0) FROM dbo.inventario i WHERE i.codneg_inv = neg.codneg_neg) AS stock_total,
        (SELECT COUNT(1) FROM dbo.facturas f WHERE f.codneg_fac = neg.codneg_neg AND f.fecha_fac >= DATEADD(DAY, -30, GETDATE())) AS facturas_30d,
        (SELECT COUNT(1) FROM dbo.facturas f WHERE f.codneg_fac = neg.codneg_neg AND f.estado_fac = 'abierta') AS facturas_abiertas,
        (SELECT COUNT(1) FROM dbo.reservas r WHERE r.codneg_res = neg.codneg_neg AND r.fecini_res >= GETDATE() AND r.fecini_res < DATEADD(DAY, 7, GETDATE()) AND r.estado_res <> 'cancelada') AS reservas_7d,
        (SELECT ISNULL(SUM(ing.monto_ing), 0) FROM dbo.ingresos ing WHERE ing.codneg_ing = neg.codneg_neg AND ing.fecha_ing >= DATEADD(DAY, -30, GETDATE())) AS ingresos_30d,
        (SELECT ISNULL(SUM(egr.monto_egr), 0) FROM dbo.egresos egr WHERE egr.codneg_egr = neg.codneg_neg AND egr.fecha_egr >= DATEADD(DAY, -30, GETDATE())) AS egresos_30d
      FROM neg
      ORDER BY neg.nombre_neg;
    `;

    const rows = esSuperAdmin
      ? (await this.sql.executeQuery(queryAdmin)) as unknown[]
      : ((await this.sql.executeQueryParams(queryUser, { codusr })) as unknown[]);

    return {
      generatedAt: new Date().toISOString(),
      negocios: rows,
    };
  }

  async resumen(codneg: number) {
    if (!codneg) {
      throw new BadRequestException('codneg es requerido');
    }

    const resumenQuery = `
      SELECT
        (SELECT COUNT(1) FROM dbo.producto p WHERE p.codneg_prd = @codneg AND p.estado_prd = 'A') AS productos_activos,
        (SELECT ISNULL(SUM(i.stock_inv), 0) FROM dbo.inventario i WHERE i.codneg_inv = @codneg) AS stock_total,
        (SELECT COUNT(1) FROM dbo.facturas f WHERE f.codneg_fac = @codneg AND f.fecha_fac >= DATEADD(DAY, -30, GETDATE())) AS facturas_30d,
        (SELECT COUNT(1) FROM dbo.facturas f WHERE f.codneg_fac = @codneg AND f.estado_fac = 'abierta') AS facturas_abiertas,
        (SELECT COUNT(1) FROM dbo.reservas r WHERE r.codneg_res = @codneg AND r.fecini_res >= GETDATE() AND r.fecini_res < DATEADD(DAY, 7, GETDATE()) AND r.estado_res <> 'cancelada') AS reservas_7d,
        (SELECT ISNULL(SUM(ing.monto_ing), 0) FROM dbo.ingresos ing WHERE ing.codneg_ing = @codneg AND ing.fecha_ing >= DATEADD(DAY, -30, GETDATE())) AS ingresos_30d,
        (SELECT ISNULL(SUM(egr.monto_egr), 0) FROM dbo.egresos egr WHERE egr.codneg_egr = @codneg AND egr.fecha_egr >= DATEADD(DAY, -30, GETDATE())) AS egresos_30d;
    `;

    const globalDefaultLowStockThreshold = 5;

    const lowStockQuery = `
      SELECT TOP (10)
        p.codprd_prd AS codprd,
        p.nombre_prd AS nombre,
        p.codigo_prd AS codigo,
        ISNULL(i.stock_inv, 0) AS stock,
        ISNULL(p.stockmin_prd, ISNULL(n.stockmin_default_neg, @globalDefault)) AS stockmin
      FROM dbo.producto p
      INNER JOIN dbo.negocios n ON n.codneg_neg = p.codneg_prd
      LEFT JOIN dbo.inventario i
        ON i.codneg_inv = p.codneg_prd
       AND i.codprd_inv = p.codprd_prd
      WHERE p.codneg_prd = @codneg
        AND p.estado_prd = 'A'
        AND ISNULL(p.stockmin_prd, n.stockmin_default_neg) IS NOT NULL
        AND ISNULL(i.stock_inv, 0) <= ISNULL(p.stockmin_prd, ISNULL(n.stockmin_default_neg, @globalDefault))
      ORDER BY ISNULL(i.stock_inv, 0) ASC, p.nombre_prd ASC;
    `;

    const reservasProxQuery = `
      SELECT TOP (5)
        r.codres_res AS codres,
        r.codcli_res AS codcli,
        r.fecini_res AS fecini,
        r.fecfin_res AS fecfin,
        r.estado_res AS estado,
        r.detalle_res AS detalle
      FROM dbo.reservas r
      WHERE r.codneg_res = @codneg
        AND r.fecini_res >= GETDATE()
        AND r.fecini_res < DATEADD(DAY, 7, GETDATE())
        AND r.estado_res <> 'cancelada'
      ORDER BY r.fecini_res ASC;
    `;

    const negocioQuery = `
      SELECT n.codneg_neg AS codneg, n.nombre_neg AS nombre
      FROM dbo.negocios n
      WHERE n.codneg_neg = @codneg;
    `;

    const [negocioRows, resumenRows, lowStockItems, reservasProxItems] =
      await Promise.all([
        this.sql.executeQueryParams(negocioQuery, { codneg }),
        this.sql.executeQueryParams(resumenQuery, { codneg }),
        this.sql.executeQueryParams(lowStockQuery, {
          codneg,
          globalDefault: globalDefaultLowStockThreshold,
        }),
        this.sql.executeQueryParams(reservasProxQuery, { codneg }),
      ]);

    const negocio = (negocioRows as any[])?.[0] ?? { codneg, nombre: null };
    const resumen = (resumenRows as any[])?.[0] ?? null;

    const alertas: any[] = [];

    const facturasAbiertas = Number(resumen?.facturas_abiertas ?? 0);
    if (facturasAbiertas > 0) {
      alertas.push({
        key: 'FACTURAS_ABIERTAS',
        titulo: 'Facturas abiertas',
        detalle: `Tienes ${facturasAbiertas} factura(s) abierta(s).`,
      });
    }

    const lowStockCount = Array.isArray(lowStockItems) ? lowStockItems.length : 0;
    if (lowStockCount > 0) {
      alertas.push({
        key: 'STOCK_BAJO',
        titulo: 'Stock bajo',
        detalle: `Productos con stock <= su mínimo (producto o default del negocio).`,
        items: lowStockItems,
      });
    }

    const reservas7d = Number(resumen?.reservas_7d ?? 0);
    if (reservas7d > 0) {
      alertas.push({
        key: 'RESERVAS_PROXIMAS',
        titulo: 'Reservas próximas (7 días)',
        detalle: `Tienes ${reservas7d} reserva(s) próximas.`,
        items: reservasProxItems,
      });
    }

    const ingresos30d = Number(resumen?.ingresos_30d ?? 0);
    const egresos30d = Number(resumen?.egresos_30d ?? 0);
    if (ingresos30d - egresos30d < 0) {
      alertas.push({
        key: 'SALDO_NEGATIVO_30D',
        titulo: 'Saldo negativo (30 días)',
        detalle: `Ingresos - egresos en 30 días es negativo.`,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      negocio,
      resumen,
      alertas,
    };
  }
}
