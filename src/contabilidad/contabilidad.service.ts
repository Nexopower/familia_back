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
          c.nombre_cta AS cuenta,
          i.monto_ing AS monto,
          i.fecha_ing AS fecha,
          i.descri_ing AS descri,
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
          c.nombre_cta AS cuenta,
          e.monto_egr AS monto,
          e.fecha_egr AS fecha,
          e.descri_egr AS descri,
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
