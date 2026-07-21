import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';
import { AuthService } from 'src/auth/auth.service';
import { SqlService } from 'src/sql/sql.service';

/**
 * Bitácora central: "Actividad reciente del negocio".
 * Une las acciones relevantes ya registradas por cada módulo (quién, qué,
 * cuándo) en una sola línea de tiempo filtrable. Protegida por AUDITORIA.VER.
 */
@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('auditoria')
export class AuditoriaController {
  constructor(
    private readonly sql: SqlService,
    private readonly authService: AuthService,
  ) {}

  @Get('actividad')
  @RequirePermiso('AUDITORIA.VER')
  async actividad(
    @Query('codneg') codneg: string | undefined,
    @Query('codusr') codusr: string | undefined,
    @Query('modulo') modulo: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    if (!Number.isFinite(codnegValue) || codnegValue <= 0) {
      throw new BadRequestException('codneg es requerido');
    }
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);

    const top = Math.min(Math.max(Number(limit) || 200, 1), 500);
    const d = desde ? new Date(desde) : null;
    const h = hasta ? new Date(hasta) : null;
    const params = {
      codneg: codnegValue,
      codusr: codusr?.trim() || null,
      modulo: modulo?.trim() || null,
      desde: d && !Number.isNaN(d.getTime()) ? d : null,
      hasta: h && !Number.isNaN(h.getTime()) ? h : null,
      top,
    };

    // UNION de las acciones ya registradas por cada módulo.
    return await this.sql.executeQueryParams(
      `
      SELECT TOP (@top) * FROM (
        SELECT 'FACTURAS' AS modulo,
               CASE WHEN f.estado_fac = 'cerrada' THEN 'Factura cerrada' ELSE 'Factura creada' END AS accion,
               CONCAT(f.tipo_fac, ' #', f.codfac_fac, ' por ', FORMAT(f.total_fac, 'N2'),
                      CASE WHEN f.fiada_fac = 1 THEN ' (FIADA)' ELSE '' END) AS detalle,
               f.codusr_fac AS codusr,
               COALESCE(f.fechmod, f.fechcrea) AS fecha
        FROM dbo.facturas f
        WHERE f.codneg_fac = @codneg

        UNION ALL
        SELECT 'INVENTARIO', CONCAT('Movimiento ', m.tipo_min),
               CONCAT(FORMAT(m.cantidad_min, 'N2'), ' — ', ISNULL(m.detalle_min, '')),
               m.codusr_min, m.fechcrea
        FROM dbo.movimientos_inventario m
        INNER JOIN dbo.inventario i ON i.codinv_inv = m.codinv_min
        WHERE i.codneg_inv = @codneg

        UNION ALL
        SELECT 'CAJA',
               CASE cr.tipo_caj WHEN 'apertura' THEN 'Apertura de caja'
                                WHEN 'cierre' THEN 'Cierre de caja'
                                ELSE 'Conteo de caja' END,
               CONCAT('Total contado ', FORMAT(cr.total_general_caj, 'N2'),
                      CASE WHEN cr.monto_retirado_caj IS NOT NULL THEN CONCAT(' / retirado ', FORMAT(cr.monto_retirado_caj, 'N2')) ELSE '' END),
               cr.codusr_caj, cr.fechcrea
        FROM dbo.caja_registros cr
        WHERE cr.codneg_caj = @codneg

        UNION ALL
        SELECT 'CONTABILIDAD', 'Ingreso registrado',
               CONCAT(FORMAT(i.monto_ing, 'N2'), ' — ', ISNULL(i.descri_ing, '')),
               i.codusr_ing, i.fechcrea
        FROM dbo.ingresos i
        WHERE i.codneg_ing = @codneg

        UNION ALL
        SELECT 'CONTABILIDAD', 'Egreso registrado',
               CONCAT(FORMAT(e.monto_egr, 'N2'), ' — ', ISNULL(e.descri_egr, '')),
               e.codusr_egr, e.fechcrea
        FROM dbo.egresos e
        WHERE e.codneg_egr = @codneg

        UNION ALL
        SELECT 'FIAOS', 'Venta fiada',
               CONCAT('Fiao #', f.codfia, ' por ', FORMAT(f.monto_fia, 'N2'), ' (factura ', f.tipo_fac_fia, '-', f.codfac_fia, ')'),
               f.codusr_fia, f.fechcrea
        FROM dbo.fiaos f
        WHERE f.codneg_fia = @codneg

        UNION ALL
        SELECT 'FIAOS', 'Abono de fiao',
               CONCAT('Fiao #', a.codfia_abo, ' abono de ', FORMAT(a.monto_abo, 'N2')),
               a.codusr_abo, a.fechcrea
        FROM dbo.fiao_abonos a
        INNER JOIN dbo.fiaos fi ON fi.codfia = a.codfia_abo
        WHERE fi.codneg_fia = @codneg

        UNION ALL
        SELECT 'FONDOS',
               CASE m.tipo_fmv WHEN 'consumo' THEN 'Consumo de fondo'
                               WHEN 'ajuste' THEN 'Recarga manual de fondo'
                               WHEN 'adelanto' THEN 'Adelanto de fondo'
                               WHEN 'transf_out' THEN 'Fondo transferido (salida)'
                               WHEN 'transf_in' THEN 'Fondo recibido (entrada)'
                               ELSE 'Acreditación de fondo' END,
               CONCAT(FORMAT(m.monto_fmv, 'N2'), ' — ', ISNULL(m.nota_fmv, ''),
                      CASE WHEN m.codfac_fmv IS NOT NULL THEN CONCAT(' (factura ', m.tipo_fac_fmv, '-', m.codfac_fmv, ')') ELSE '' END),
               m.codusr_fmv, m.fechcrea
        FROM dbo.fondo_movimientos m
        INNER JOIN dbo.cliente_fondo cf ON cf.codfon = m.codfon_fmv
        WHERE cf.codneg_fon = @codneg AND m.tipo_fmv <> 'acreditacion'
      ) t
      WHERE (@codusr IS NULL OR t.codusr = @codusr)
        AND (@modulo IS NULL OR t.modulo = @modulo)
        AND (@desde IS NULL OR t.fecha >= @desde)
        AND (@hasta IS NULL OR t.fecha < DATEADD(DAY, 1, @hasta))
      ORDER BY t.fecha DESC;
      `,
      params,
    );
  }
}
