import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

/**
 * FONDOS de clientes — cartera prepagada con límite diario.
 *
 * saldo = Σ(ajuste/recarga + transf_in) − Σ(consumo + adelanto + transf_out)
 * El saldo es el tope TOTAL consumible (lo que se le recargó/transfirió).
 * monto_diario es el LÍMITE que puede consumir por día, y solo puede
 * consumir en los días habilitados (bitmask dias_semana).
 *
 * Adelanto (máx. 1 activo): toma prestado del límite del PRÓXIMO día
 * habilitado; se registra como movimiento 'adelanto' con fecha_aplicacion
 * futura, así ese día su límite queda reducido (150 → 125 si adelantó 25).
 * También descuenta saldo (es consumo real de la cartera).
 *
 * Bitmask días: bit0=Domingo, bit1=Lunes ... bit6=Sábado (127 = todos).
 */
@Injectable()
export class FondosService {
  constructor(private readonly sql: SqlService) {}

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación.'
    );
  }

  private async saldoDe(codfon: number): Promise<number> {
    const rows = await this.sql.executeQueryParams(
      `SELECT ISNULL(SUM(CASE tipo_fmv
                WHEN 'ajuste' THEN monto_fmv
                WHEN 'transf_in' THEN monto_fmv
                WHEN 'consumo' THEN -monto_fmv
                WHEN 'adelanto' THEN -monto_fmv
                WHEN 'transf_out' THEN -monto_fmv
                ELSE 0 END), 0) AS saldo
       FROM dbo.fondo_movimientos WHERE codfon_fmv = @codfon;`,
      { codfon },
    );
    return Number(rows?.[0]?.saldo ?? 0);
  }

  /** Consumido contra el límite de HOY (consumos de hoy + adelantos que apuntan a hoy). */
  private async consumidoHoy(codfon: number): Promise<number> {
    const rows = await this.sql.executeQueryParams(
      `SELECT ISNULL(SUM(monto_fmv), 0) AS total
       FROM dbo.fondo_movimientos
       WHERE codfon_fmv = @codfon AND tipo_fmv IN ('consumo','adelanto')
         AND fecha_aplicacion_fmv = CAST(GETDATE() AS date);`,
      { codfon },
    );
    return Number(rows?.[0]?.total ?? 0);
  }

  /** ¿Tiene un adelanto que aplica a un día futuro? (máx. 1 activo) */
  private async adelantoActivo(codfon: number): Promise<boolean> {
    const rows = await this.sql.executeQueryParams(
      `SELECT TOP 1 1 AS ok
       FROM dbo.fondo_movimientos
       WHERE codfon_fmv = @codfon AND tipo_fmv = 'adelanto'
         AND fecha_aplicacion_fmv > CAST(GETDATE() AS date);`,
      { codfon },
    );
    return Boolean(rows?.length);
  }

  private hoyHabilitado(mask: number): boolean {
    return (mask & (1 << new Date().getDay())) > 0;
  }

  /** Próximo día habilitado DESPUÉS de hoy (de dónde toma el adelanto). */
  private proximoDiaHabilitado(mask: number): string | null {
    const d = new Date();
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() + 1);
      if ((mask & (1 << d.getDay())) > 0) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    return null;
  }

  /** Estado operativo del fondo: saldo, disponible hoy y adelanto posible. */
  private async estadoDe(codfon: number, montoDiario: number, mask: number) {
    const saldo = await this.saldoDe(codfon);
    const hoyHab = this.hoyHabilitado(mask);
    const consumidoHoy = hoyHab ? await this.consumidoHoy(codfon) : 0;
    const adelantoActivo = await this.adelantoActivo(codfon);
    const proximoDia = this.proximoDiaHabilitado(mask);
    // Hoy puede consumir hasta el límite diario (menos lo ya consumido), sin exceder el saldo.
    const disponibleHoy = hoyHab
      ? Math.max(0, Math.min(saldo, montoDiario - consumidoHoy))
      : 0;
    // Adelanto: hasta el límite del próximo día habilitado, sin exceder el saldo restante.
    const adelantoPosible =
      !adelantoActivo && proximoDia
        ? Math.max(0, Math.min(montoDiario, saldo - disponibleHoy))
        : 0;
    return {
      saldo,
      hoy_habilitado: hoyHab,
      consumido_hoy: consumidoHoy,
      disponible_hoy: disponibleHoy,
      adelanto_activo: adelantoActivo,
      adelanto_posible: adelantoPosible,
      disponible_con_adelanto: disponibleHoy + adelantoPosible,
      proximo_dia_habilitado: proximoDia,
    };
  }

  /* ── Configuración ── */
  async listar(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    const fondos = await this.sql.executeQueryParams(
      `SELECT f.codfon, f.codcli_fon AS codcli, f.monto_diario_fon AS monto_diario,
              f.dias_semana_fon AS dias_semana, f.estado_fon AS estado,
              CONCAT(p.nombre_per, ' ', ISNULL(p.apellidos_per, '')) AS cliente_nombre
       FROM dbo.cliente_fondo f
       INNER JOIN dbo.clientes c ON c.codcli_cli = f.codcli_fon
       INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
       WHERE f.codneg_fon = @codneg
       ORDER BY f.estado_fon, p.nombre_per;`,
      { codneg },
    );
    const out: any[] = [];
    for (const f of fondos ?? []) {
      const estado =
        f.estado === 'A'
          ? await this.estadoDe(Number(f.codfon), Number(f.monto_diario), Number(f.dias_semana))
          : null;
      out.push({
        ...f,
        saldo: estado ? estado.saldo : await this.saldoDe(Number(f.codfon)),
        disponible_hoy: estado?.disponible_hoy ?? 0,
        adelanto_activo: estado?.adelanto_activo ?? false,
        proximo_dia_habilitado: estado?.proximo_dia_habilitado ?? null,
      });
    }
    return out;
  }

  async crear(dto: {
    codneg: number; codcli: number; montoDiario: number; diasSemana: number;
    usercrea?: number | null;
  }) {
    if (!dto.codneg || !dto.codcli) throw new BadRequestException('codneg y codcli son requeridos');
    if (!(dto.montoDiario > 0)) throw new BadRequestException('límite diario inválido');
    const mask = Number(dto.diasSemana) & 127;
    if (mask === 0) throw new BadRequestException('Selecciona al menos un día habilitado');
    try {
      // Nace con saldo 0: el saldo entra por recargas ("+ Saldo") o transferencias.
      const rows = await this.sql.executeQueryParams(
        `INSERT INTO dbo.cliente_fondo (codneg_fon, codcli_fon, monto_diario_fon, dias_semana_fon, usercrea)
         OUTPUT INSERTED.codfon AS codfon
         VALUES (@codneg, @codcli, @monto, @mask, @usercrea);`,
        { codneg: dto.codneg, codcli: dto.codcli, monto: dto.montoDiario, mask, usercrea: dto.usercrea ?? null },
      );
      return { codfon: Number(rows?.[0]?.codfon) };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async actualizar(dto: {
    codfon: number; codneg: number;
    montoDiario?: number; diasSemana?: number; estado?: 'A' | 'I';
    usermod?: number | null;
  }) {
    const set: string[] = [];
    const params: Record<string, any> = { codfon: dto.codfon, codneg: dto.codneg, usermod: dto.usermod ?? null };
    if (dto.montoDiario !== undefined) {
      if (!(Number(dto.montoDiario) > 0)) throw new BadRequestException('límite diario inválido');
      set.push('monto_diario_fon = @monto'); params.monto = Number(dto.montoDiario);
    }
    if (dto.diasSemana !== undefined) {
      const mask = Number(dto.diasSemana) & 127;
      if (mask === 0) throw new BadRequestException('Selecciona al menos un día habilitado');
      set.push('dias_semana_fon = @mask'); params.mask = mask;
    }
    if (dto.estado !== undefined) { set.push('estado_fon = @estado'); params.estado = dto.estado === 'I' ? 'I' : 'A'; }
    if (!set.length) throw new BadRequestException('No hay campos para actualizar');

    await this.sql.executeQueryParams(
      `UPDATE dbo.cliente_fondo SET ${set.join(', ')}, usermod = @usermod, fechmod = GETDATE()
       WHERE codfon = @codfon AND codneg_fon = @codneg;`,
      params,
    );
    return { ok: true };
  }

  /** Recarga manual: sube el saldo del fondo con un movimiento tipo 'ajuste'. */
  async recargar(dto: {
    codfon: number; codneg: number; monto: number; nota?: string | null;
    codusr?: string | null; usercrea?: number | null;
  }) {
    if (!(Number(dto.monto) > 0)) throw new BadRequestException('El monto debe ser mayor a 0');
    const rows = await this.sql.executeQueryParams(
      `SELECT codfon FROM dbo.cliente_fondo
       WHERE codfon = @codfon AND codneg_fon = @codneg AND estado_fon = 'A';`,
      { codfon: dto.codfon, codneg: dto.codneg },
    );
    if (!rows?.length) throw new BadRequestException('Fondo no existe o está inactivo en este negocio');

    try {
      await this.sql.executeQueryParams(
        `INSERT INTO dbo.fondo_movimientos (codfon_fmv, tipo_fmv, monto_fmv, fecha_aplicacion_fmv, nota_fmv, codusr_fmv, usercrea)
         VALUES (@codfon, 'ajuste', @monto, CAST(GETDATE() AS date), @nota, @codusr, @usercrea);`,
        {
          codfon: dto.codfon, monto: Number(dto.monto),
          nota: dto.nota?.trim() || 'Recarga manual de saldo',
          codusr: dto.codusr ?? null, usercrea: dto.usercrea ?? null,
        },
      );
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
    return { ok: true, saldo: await this.saldoDe(dto.codfon) };
  }

  /** Estado del fondo de un cliente (para facturación). */
  async saldoCliente(codneg: number, codcli: number) {
    const rows = await this.sql.executeQueryParams(
      `SELECT codfon, monto_diario_fon AS monto_diario, dias_semana_fon AS dias_semana
       FROM dbo.cliente_fondo
       WHERE codneg_fon = @codneg AND codcli_fon = @codcli AND estado_fon = 'A';`,
      { codneg, codcli },
    );
    const f = rows?.[0];
    if (!f) return { tiene_fondo: false };
    const codfon = Number(f.codfon);
    const estado = await this.estadoDe(codfon, Number(f.monto_diario), Number(f.dias_semana));
    return {
      tiene_fondo: true,
      codfon,
      monto_diario: Number(f.monto_diario),
      dias_semana: Number(f.dias_semana),
      ...estado,
    };
  }

  /**
   * Consume fondo por una factura, respetando el límite diario.
   * Si excede el disponible de hoy y adelantar=true, la diferencia se
   * registra como 'adelanto' contra el límite del próximo día habilitado.
   * Si la factura es FIADA, la parte fondo SÍ se contabiliza como ingreso
   * (es dinero ya pre-pagado, no deuda).
   */
  async consumir(dto: {
    codneg: number; codcli: number; monto: number;
    tipo: string; codfac: number;
    adelantar?: boolean; facturaFiada?: boolean;
    codusr?: string | null; usercrea?: number | null;
  }) {
    const monto = Number(dto.monto);
    if (!(monto > 0)) throw new BadRequestException('Monto de fondo inválido');

    const info: any = await this.saldoCliente(dto.codneg, dto.codcli);
    if (!info.tiene_fondo) throw new BadRequestException('El cliente no tiene fondo activo en este negocio');

    if (monto > Number(info.saldo) + 0.005) {
      throw new BadRequestException(`Saldo del fondo insuficiente (saldo ${Number(info.saldo).toFixed(2)}).`);
    }

    const disponibleHoy = Number(info.disponible_hoy);
    const parteHoy = Math.min(monto, disponibleHoy);
    const parteAdelanto = Math.round((monto - parteHoy) * 100) / 100;

    if (parteAdelanto > 0.005) {
      if (!dto.adelantar) {
        if (!info.hoy_habilitado) {
          throw new BadRequestException('Hoy no es un día habilitado del fondo: requiere adelanto del próximo día.');
        }
        throw new BadRequestException(
          `Excede el límite diario (disponible hoy ${disponibleHoy.toFixed(2)}): faltan ${parteAdelanto.toFixed(2)}, requiere adelanto o pagarse aparte.`,
        );
      }
      if (info.adelanto_activo) {
        throw new BadRequestException('Ya existe un adelanto activo (máximo 1).');
      }
      if (!info.proximo_dia_habilitado) {
        throw new BadRequestException('No hay próximo día habilitado para adelantar.');
      }
      if (parteAdelanto > Number(info.adelanto_posible) + 0.005) {
        throw new BadRequestException(
          `El adelanto máximo es ${Number(info.adelanto_posible).toFixed(2)} (límite del próximo día y saldo disponible).`,
        );
      }
    }

    try {
      if (parteHoy > 0.005) {
        await this.sql.executeQueryParams(
          `INSERT INTO dbo.fondo_movimientos (codfon_fmv, tipo_fmv, monto_fmv, fecha_aplicacion_fmv, tipo_fac_fmv, codfac_fmv, nota_fmv, codusr_fmv, usercrea)
           VALUES (@codfon, 'consumo', @monto, CAST(GETDATE() AS date), @tipo, @codfac, N'Consumo por factura', @codusr, @usercrea);`,
          { codfon: info.codfon, monto: parteHoy, tipo: dto.tipo, codfac: dto.codfac, codusr: dto.codusr ?? null, usercrea: dto.usercrea ?? null },
        );
      }
      if (parteAdelanto > 0.005) {
        // Consume el límite del día futuro: ese día tendrá menos disponible.
        await this.sql.executeQueryParams(
          `INSERT INTO dbo.fondo_movimientos (codfon_fmv, tipo_fmv, monto_fmv, fecha_aplicacion_fmv, tipo_fac_fmv, codfac_fmv, nota_fmv, codusr_fmv, usercrea)
           VALUES (@codfon, 'adelanto', @monto, @fecha, @tipo, @codfac, @nota, @codusr, @usercrea);`,
          {
            codfon: info.codfon, monto: parteAdelanto, fecha: info.proximo_dia_habilitado,
            tipo: dto.tipo, codfac: dto.codfac,
            nota: `Adelanto del límite del ${info.proximo_dia_habilitado}`,
            codusr: dto.codusr ?? null, usercrea: dto.usercrea ?? null,
          },
        );
      }
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }

    // Factura fiada: la parte cubierta con fondo SÍ es ingreso de hoy.
    if (dto.facturaFiada) {
      await this.sql.executeQueryParams(
        `DECLARE @codcta int, @coding int;
         EXEC dbo.sp_contabilidad_cuenta_resolver @codneg=@codneg, @concepto='venta', @usercrea=@usercrea, @codcta_out=@codcta OUTPUT;
         EXEC dbo.sp_ingreso_registrar @codneg=@codneg, @codcta=@codcta, @monto=@monto,
           @descri=@descri, @refdoc=@refdoc, @codusr=@codusr, @usercrea=@usercrea, @coding_out=@coding OUTPUT;`,
        {
          codneg: dto.codneg, monto,
          descri: `Consumo fondo (factura ${dto.tipo}-${dto.codfac} fiada)`,
          refdoc: `fondo-${dto.tipo}-${dto.codfac}`,
          codusr: dto.codusr ?? null, usercrea: dto.usercrea ?? null,
        },
      );
    }

    return { ok: true, consumido: monto, adelantado: parteAdelanto > 0.005 ? parteAdelanto : 0 };
  }

  /** Transfiere saldo del fondo de un cliente entre negocios (misma persona). */
  async transferir(dto: {
    codfonOrigen: number; codneg: number; codnegDestino: number;
    monto: number; nota?: string | null;
    codusr?: string | null; usercrea?: number | null;
  }) {
    const monto = Number(dto.monto);
    if (!(monto > 0)) throw new BadRequestException('Monto inválido');
    if (Number(dto.codnegDestino) === Number(dto.codneg)) {
      throw new BadRequestException('El negocio destino debe ser distinto al origen');
    }

    // Fondo destino: mismo cliente (misma persona) en el negocio destino.
    const destinoRows = await this.sql.executeQueryParams(
      `SELECT fd.codfon AS codfon_destino
       FROM dbo.cliente_fondo fo
       INNER JOIN dbo.clientes co ON co.codcli_cli = fo.codcli_fon
       INNER JOIN dbo.clientes cd ON cd.codper_cli = co.codper_cli AND cd.codneg_cli = @codnegDestino
       INNER JOIN dbo.cliente_fondo fd ON fd.codcli_fon = cd.codcli_cli AND fd.codneg_fon = @codnegDestino AND fd.estado_fon = 'A'
       WHERE fo.codfon = @codfonOrigen AND fo.codneg_fon = @codneg;`,
      { codfonOrigen: dto.codfonOrigen, codneg: dto.codneg, codnegDestino: dto.codnegDestino },
    );
    const codfonDestino = Number(destinoRows?.[0]?.codfon_destino);
    if (!codfonDestino) {
      throw new BadRequestException('El cliente no tiene fondo activo en el negocio destino.');
    }

    const saldo = await this.saldoDe(dto.codfonOrigen);
    if (monto > saldo) {
      throw new BadRequestException(`Saldo insuficiente para transferir (disponible ${saldo.toFixed(2)}).`);
    }

    try {
      await this.sql.executeQueryParams(
        `SET NOCOUNT ON;
         BEGIN TRY
           BEGIN TRAN;
           DECLARE @hoy date = CAST(GETDATE() AS date);

           INSERT INTO dbo.fondo_transferencias (codfon_origen_ftr, codfon_destino_ftr, monto_ftr, nota_ftr, codusr_ftr, usercrea)
           VALUES (@origen, @destino, @monto, @nota, @codusr, @usercrea);
           DECLARE @codftr int = SCOPE_IDENTITY();

           INSERT INTO dbo.fondo_movimientos (codfon_fmv, tipo_fmv, monto_fmv, fecha_aplicacion_fmv, nota_fmv, codusr_fmv, usercrea)
           VALUES (@origen, 'transf_out', @monto, @hoy, CONCAT(N'Transferencia #', @codftr, N' enviada'), @codusr, @usercrea),
                  (@destino, 'transf_in', @monto, @hoy, CONCAT(N'Transferencia #', @codftr, N' recibida'), @codusr, @usercrea);
           COMMIT;
           SELECT @codftr AS codftr;
         END TRY
         BEGIN CATCH
           IF @@TRANCOUNT > 0 ROLLBACK; THROW;
         END CATCH`,
        {
          origen: dto.codfonOrigen, destino: codfonDestino, monto,
          nota: dto.nota ?? null, codusr: dto.codusr ?? null, usercrea: dto.usercrea ?? null,
        },
      );
      return { ok: true };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async historial(codfon: number, codneg: number) {
    return await this.sql.executeQueryParams(
      `SELECT TOP 200 m.codfmv, m.tipo_fmv AS tipo, m.monto_fmv AS monto,
              m.fecha_aplicacion_fmv AS fecha_aplicacion, m.fechcrea AS fecha_real,
              m.tipo_fac_fmv AS tipo_fac, m.codfac_fmv AS codfac,
              m.nota_fmv AS nota, m.codusr_fmv AS codusr
       FROM dbo.fondo_movimientos m
       INNER JOIN dbo.cliente_fondo f ON f.codfon = m.codfon_fmv
       WHERE m.codfon_fmv = @codfon AND f.codneg_fon = @codneg
       ORDER BY m.fechcrea DESC, m.codfmv DESC;`,
      { codfon, codneg },
    );
  }

  /** Consumo total vía fondos en un período (para cuadre/desglose). */
  async consumoPeriodo(codneg: number, desde: Date | null, hasta: Date | null) {
    const rows = await this.sql.executeQueryParams(
      `SELECT ISNULL(SUM(m.monto_fmv), 0) AS total
       FROM dbo.fondo_movimientos m
       INNER JOIN dbo.cliente_fondo f ON f.codfon = m.codfon_fmv
       WHERE f.codneg_fon = @codneg AND m.tipo_fmv IN ('consumo','adelanto')
         AND (@desde IS NULL OR m.fechcrea >= @desde)
         AND (@hasta IS NULL OR m.fechcrea < DATEADD(DAY, 1, @hasta));`,
      { codneg, desde: desde ?? null, hasta: hasta ?? null },
    );
    return Number(rows?.[0]?.total ?? 0);
  }
}
