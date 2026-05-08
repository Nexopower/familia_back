import { Injectable, BadRequestException } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

@Injectable()
export class InventarioService {
  constructor(private readonly sql: SqlService) {}

  async listarStock(dto: {
    codneg: number;
    codprd?: number | null;
    q?: string | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');

    const q = (dto.q ?? '').trim();
    const codprd = dto.codprd ? Number(dto.codprd) : null;

    const query = `
      SELECT
        p.codprd_prd AS codprd,
        p.codneg_prd AS codneg,
        ISNULL(i.codinv_inv, 0) AS codinv,
        p.nombre_prd AS nombre,
        p.codigo_prd AS codigo,
        ISNULL(i.stock_inv, 0) AS stock,
        p.estado_prd AS estado
      FROM dbo.producto p
      LEFT JOIN dbo.inventario i
        ON i.codneg_inv = p.codneg_prd
       AND i.codprd_inv = p.codprd_prd
      WHERE p.codneg_prd = @codneg
        AND p.estado_prd = 'A'
        AND (@codprd IS NULL OR p.codprd_prd = @codprd)
        AND (
          @q = ''
          OR p.nombre_prd LIKE '%' + @q + '%'
          OR p.codigo_prd LIKE '%' + @q + '%'
        )
      ORDER BY p.nombre_prd;
    `;

    return await this.sql.executeQueryParams(query, {
      codneg: Number(dto.codneg),
      codprd,
      q,
    });
  }

  async listarMovimientos(dto: {
    codneg: number;
    codprd?: number | null;
    desde?: Date | null;
    hasta?: Date | null;
    limit?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');

    const codprd = dto.codprd ? Number(dto.codprd) : null;
    const limit = Math.min(Math.max(Number(dto.limit ?? 100), 1), 500);

    const query = `
      SELECT TOP (@limit)
        m.codmin_min AS codmin,
        i.codinv_inv AS codinv,
        i.codneg_inv AS codneg,
        i.codprd_inv AS codprd,
        p.nombre_prd AS producto,
        p.codigo_prd AS codigo,
        m.tipo_min AS tipo,
        m.cantidad_min AS cantidad,
        m.fecha_min AS fecha,
        m.codusr_min AS codusr,
        m.detalle_min AS detalle
      FROM dbo.movimientos_inventario m
      INNER JOIN dbo.inventario i ON i.codinv_inv = m.codinv_min
      INNER JOIN dbo.producto p ON p.codprd_prd = i.codprd_inv
      WHERE i.codneg_inv = @codneg
        AND (@codprd IS NULL OR i.codprd_inv = @codprd)
        AND (@desde IS NULL OR m.fecha_min >= @desde)
        AND (@hasta IS NULL OR m.fecha_min < DATEADD(DAY, 1, @hasta))
      ORDER BY m.fecha_min DESC;
    `;

    return await this.sql.executeQueryParams(query, {
      codneg: Number(dto.codneg),
      codprd,
      desde: dto.desde ?? null,
      hasta: dto.hasta ?? null,
      limit,
    });
  }

  async stock(codneg: number, codprd: number) {
    if (!codneg || !codprd)
      throw new BadRequestException('codneg y codprd son requeridos');
    const query = `SELECT dbo.fn_stock_actual(@codneg, @codprd) AS stock`;
    const rows = await this.sql.executeQueryParams(query, { codneg, codprd });
    return rows?.[0] ?? { stock: 0 };
  }

  async movimiento(dto: {
    codneg: number;
    codprd: number;
    tipo: string;
    cantidad: number;
    detalle?: string;
    codusr?: string;
    usercrea?: number;
  }) {
    if (!dto.codneg || !dto.codprd || !dto.tipo || !dto.cantidad) {
      throw new BadRequestException(
        'codneg, codprd, tipo y cantidad son requeridos',
      );
    }

    const tipo = String(dto.tipo).trim().toLowerCase();
    if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
      throw new BadRequestException(
        'tipo inválido. Use: entrada, salida, ajuste',
      );
    }

    // Asegurar inventario
    await this.sql.executeQueryParams(
      'EXEC dbo.sp_inventario_asegurar @codneg, @codprd, @usercrea',
      {
        codneg: dto.codneg,
        codprd: dto.codprd,
        usercrea: dto.usercrea ?? null,
      },
    );

    // Registrar movimiento
    const query = `
            DECLARE @codmin_out INT;
            EXEC dbo.sp_inventario_movimiento_registrar
                @codneg = @codneg,
                @codprd = @codprd,
                @tipo = @tipo,
                @cantidad = @cantidad,
                @detalle = @detalle,
                @codusr = @codusr,
                @usercrea = @usercrea,
                @codmin_out = @codmin_out OUTPUT;
            SELECT @codmin_out AS codmin;
        `;

    const rows = await this.sql.executeQueryParams(query, {
      codneg: dto.codneg,
      codprd: dto.codprd,
      tipo,
      cantidad: dto.cantidad,
      detalle: dto.detalle ?? null,
      codusr: dto.codusr ?? null,
      usercrea: dto.usercrea ?? null,
    });

    return rows?.[0];
  }
}
