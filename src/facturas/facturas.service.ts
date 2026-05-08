import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

interface CrearFacturaDto {
  codneg: number;
  tipo: string;
  codcli?: number;
  codpro?: number;
  codusr?: string;
  usercrea?: number;
}

interface DetalleFacturaDto {
  codfac: number;
  codprd: number;
  cantidad: number;
  preuni: number;
  usercrea?: number;
}

@Injectable()
export class FacturasService {
  constructor(private readonly sql: SqlService) {}

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación.'
    );
  }

  private normalizeTipo(tipo: unknown): 'venta' | 'compra' {
    const value = String(tipo ?? '').trim().toLowerCase();
    if (value === 'venta' || value === 'compra') return value;
    throw new BadRequestException('tipo inválido. Use: venta, compra');
  }

  private normalizeEstado(estado: unknown): string | null {
    const value = String(estado ?? '').trim().toLowerCase();
    if (!value) return null;
    if (value === 'abierta' || value === 'cerrada') return value;
    throw new BadRequestException('estado inválido. Use: abierta, cerrada');
  }

  async obtenerMeta(codfac: number): Promise<{ codfac: number; codneg: number; estado: string; tipo: string }> {
    if (!codfac) throw new BadRequestException('codfac es requerido');

    const rows = await this.sql.executeQueryParams(
      `
        SELECT
          f.codfac_fac AS codfac,
          f.codneg_fac AS codneg,
          f.estado_fac AS estado,
          f.tipo_fac AS tipo
        FROM dbo.facturas f
        WHERE f.codfac_fac = @codfac;
      `,
      { codfac },
    );

    const meta = rows?.[0];
    if (!meta) throw new NotFoundException('Factura no encontrada');
    return meta;
  }

  async listar(dto: {
    codneg: number;
    tipo?: string | null;
    estado?: string | null;
    desde?: Date | null;
    hasta?: Date | null;
    limit?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');

    const tipo = dto.tipo ? this.normalizeTipo(dto.tipo) : null;
    const estado = dto.estado ? this.normalizeEstado(dto.estado) : null;
    const limit = Math.min(Math.max(Number(dto.limit ?? 100), 1), 500);

    const query = `
      SELECT TOP (@limit)
        f.codfac_fac AS codfac,
        f.codneg_fac AS codneg,
        f.codcli_fac AS codcli,
        f.codpro_fac AS codpro,
        f.fecha_fac AS fecha,
        f.total_fac AS total,
        f.tipo_fac AS tipo,
        f.estado_fac AS estado,
        f.codusr_fac AS codusr
      FROM dbo.facturas f
      WHERE f.codneg_fac = @codneg
        AND (@tipo IS NULL OR f.tipo_fac = @tipo)
        AND (@estado IS NULL OR f.estado_fac = @estado)
        AND (@desde IS NULL OR f.fecha_fac >= @desde)
        AND (@hasta IS NULL OR f.fecha_fac < DATEADD(DAY, 1, @hasta))
      ORDER BY f.fecha_fac DESC, f.codfac_fac DESC;
    `;

    return await this.sql.executeQueryParams(query, {
      codneg: dto.codneg,
      tipo,
      estado,
      desde: dto.desde ?? null,
      hasta: dto.hasta ?? null,
      limit,
    });
  }

  async crear(dto: CrearFacturaDto) {
    if (!dto.codneg || !dto.tipo) {
      throw new BadRequestException('codneg y tipo son requeridos');
    }

    try {
      const tipo = this.normalizeTipo(dto.tipo);
      const query = `
                DECLARE @codfac_out INT;
                EXEC dbo.sp_factura_crear
                    @codneg = @codneg,
                    @tipo = @tipo,
                    @codcli = @codcli,
                    @codpro = @codpro,
                    @codusr = @codusr,
                    @usercrea = @usercrea,
                    @codfac_out = @codfac_out OUTPUT;
                SELECT @codfac_out AS codfac;
            `;

      const rows = await this.sql.executeQueryParams(query, {
        codneg: dto.codneg,
        tipo,
        codcli: dto.codcli ?? null,
        codpro: dto.codpro ?? null,
        codusr: dto.codusr ?? null,
        usercrea: dto.usercrea ?? null,
      });

      const codfac = rows?.[0]?.codfac;
      if (!codfac) {
        throw new BadRequestException('No se pudo crear la factura');
      }

      return await this.obtener(codfac, dto.codneg);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async agregarDetalle(dto: DetalleFacturaDto) {
    if (
      !dto.codfac ||
      !dto.codprd ||
      !dto.cantidad ||
      dto.preuni === undefined
    ) {
      throw new BadRequestException(
        'codfac, codprd, cantidad y preuni son requeridos',
      );
    }

    try {
      const query = `
                DECLARE @codfdt_out INT;
                EXEC dbo.sp_factura_detalle_agregar
                    @codfac = @codfac,
                    @codprd = @codprd,
                    @cantidad = @cantidad,
                    @preuni = @preuni,
                    @usercrea = @usercrea,
                    @codfdt_out = @codfdt_out OUTPUT;
                SELECT @codfdt_out AS codfdt;
            `;

      const rows = await this.sql.executeQueryParams(query, {
        codfac: dto.codfac,
        codprd: dto.codprd,
        cantidad: dto.cantidad,
        preuni: dto.preuni,
        usercrea: dto.usercrea ?? null,
      });

      const codfdt = rows?.[0]?.codfdt;
      if (!codfdt) {
        throw new BadRequestException('No se pudo agregar el detalle');
      }

      const meta = await this.obtenerMeta(dto.codfac);
      return await this.obtener(dto.codfac, meta.codneg);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async cerrar(codfac: number, codusr?: string, usercrea?: number) {
    if (!codfac) {
      throw new BadRequestException('codfac es requerido');
    }

    try {
      await this.sql.executeQueryParams(
        `EXEC dbo.sp_factura_cerrar @codfac = @codfac, @codusr = @codusr, @usercrea = @usercrea;`,
        {
          codfac,
          codusr: codusr ?? null,
          usercrea: usercrea ?? null,
        },
      );

      return { ok: true };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async obtener(codfac: number, codneg?: number) {
    if (!codfac) {
      throw new BadRequestException('codfac es requerido');
    }

    try {
      const whereCodneg = codneg ? 'AND f.codneg_fac = @codneg' : '';

      const facturaRows = await this.sql.executeQueryParams(
        `
          SELECT
            f.codfac_fac AS codfac,
            f.codneg_fac AS codneg,
            f.codcli_fac AS codcli,
            f.codpro_fac AS codpro,
            f.fecha_fac AS fecha,
            f.total_fac AS total,
            f.tipo_fac AS tipo,
            f.estado_fac AS estado,
            f.codusr_fac AS codusr
          FROM dbo.facturas f
          WHERE f.codfac_fac = @codfac
            ${whereCodneg};
        `,
        { codfac, codneg: codneg ?? null },
      );

      const factura = facturaRows?.[0];
      if (!factura) throw new NotFoundException('Factura no encontrada');

      const detalle = await this.sql.executeQueryParams(
        `
          SELECT
            fd.codfdt_fdt AS codfdt,
            fd.codfac_fdt AS codfac,
            fd.codprd_fdt AS codprd,
            p.nombre_prd AS producto,
            p.codigo_prd AS codigo,
            fd.cantidad_fdt AS cantidad,
            fd.preuni_fdt AS preuni,
            fd.subtotal_fdt AS subtotal
          FROM dbo.factura_detalle fd
          INNER JOIN dbo.producto p ON p.codprd_prd = fd.codprd_fdt
          WHERE fd.codfac_fdt = @codfac
          ORDER BY fd.codfdt_fdt;
        `,
        { codfac },
      );

      return { factura, detalle };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(this.formatError(error));
    }
  }
}
