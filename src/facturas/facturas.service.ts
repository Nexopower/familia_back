import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';
import { FiaosService } from 'src/fiaos/fiaos.service';
import { FondosService } from 'src/fondos/fondos.service';

interface CrearFacturaDto {
  codneg: number;
  tipo: string;
  codcli?: number;
  codpro?: number;
  codusr?: string;
  usercrea?: number;
}

interface CrearFacturaCompletaDto extends CrearFacturaDto {
  items: Array<{ codprd: number; cantidad: number; preuni?: number | null }>;
  cerrar?: boolean;
  efectivo?: number | null;
  /** Venta a crédito: requiere cliente; no contabiliza el ingreso al cerrar. */
  fiar?: boolean;
  /** Monto que se fía (puede ser parcial: total − fondo − efectivo). Si falta, se fía todo el restante tras fondo. */
  fiarMonto?: number | null;
  /** Monto de la factura cubierto con el fondo diario del cliente. */
  fondoAplicar?: number | null;
  /** Permite exceder el saldo del fondo adelantando el próximo día habilitado. */
  fondoAdelantar?: boolean;
  autorizacion?: { codusr: string; auditId?: number | null } | null;
}

interface DetalleFacturaDto {
  tipo?: string;
  codfac: number;
  codprd: number;
  cantidad: number;
  preuni: number | null;
  usercrea?: number;
}

@Injectable()
export class FacturasService {
  constructor(
    private readonly sql: SqlService,
    private readonly fiaos: FiaosService,
    private readonly fondos: FondosService,
  ) {}

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

  async obtenerMeta(
    codfac: number,
    tipo?: string | null,
  ): Promise<{ codfac: number; codneg: number; estado: string; tipo: string }> {
    if (!codfac) throw new BadRequestException('codfac es requerido');

    const tipoValue = tipo ? this.normalizeTipo(tipo) : null;

    const rows = await this.sql.executeQueryParams(
      `
        SELECT
          f.codfac_fac AS codfac,
          f.codneg_fac AS codneg,
          f.estado_fac AS estado,
          f.tipo_fac AS tipo
        FROM dbo.facturas f
        WHERE f.codfac_fac = @codfac
          AND (@tipo IS NULL OR f.tipo_fac = @tipo);
      `,
      { codfac, tipo: tipoValue },
    );

    if (!tipoValue && rows.length > 1) {
      throw new BadRequestException('tipo es requerido porque el código existe en más de un tipo de factura');
    }

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
        f.codusr_fac AS codusr,
        CASE
          WHEN f.tipo_fac = 'venta' THEN CONCAT(ISNULL(pcli.nombre_per, ''), CASE WHEN pcli.apellidos_per IS NULL OR LTRIM(RTRIM(pcli.apellidos_per)) = '' THEN '' ELSE CONCAT(' ', pcli.apellidos_per) END)
          ELSE NULL
        END AS cliente_nombre,
        CASE
          WHEN f.tipo_fac = 'compra' THEN CONCAT(ISNULL(ppro.nombre_per, ''), CASE WHEN ppro.apellidos_per IS NULL OR LTRIM(RTRIM(ppro.apellidos_per)) = '' THEN '' ELSE CONCAT(' ', ppro.apellidos_per) END)
          ELSE NULL
        END AS proveedor_nombre
      FROM dbo.facturas f
      LEFT JOIN dbo.clientes c ON c.codcli_cli = f.codcli_fac
      LEFT JOIN dbo.personas pcli ON pcli.codper_per = c.codper_cli
      LEFT JOIN dbo.proveedores pr ON pr.codpro_pro = f.codpro_fac
      LEFT JOIN dbo.personas ppro ON ppro.codper_per = pr.codper_pro
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

      return await this.obtener(codfac, dto.codneg, tipo);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async crearCompleta(dto: CrearFacturaCompletaDto) {
    if (!dto.codneg || !dto.tipo) {
      throw new BadRequestException('codneg y tipo son requeridos');
    }

    const tipo = this.normalizeTipo(dto.tipo);
    const items = Array.isArray(dto.items) ? dto.items : [];
    if (!items.length) throw new BadRequestException('items es requerido');

    // Validación rápida de items
    const normItems = items.map((it, idx) => {
      const codprd = Number(it?.codprd);
      const cantidad = Number(it?.cantidad);
      const preuni = it?.preuni === undefined ? null : it.preuni;
      if (!Number.isFinite(codprd) || codprd <= 0) {
        throw new BadRequestException(`items[${idx}].codprd inválido`);
      }
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new BadRequestException(`items[${idx}].cantidad inválida`);
      }
      if (preuni !== null && preuni !== undefined) {
        const n = Number(preuni);
        if (!Number.isFinite(n) || n < 0) {
          throw new BadRequestException(`items[${idx}].preuni inválido`);
        }
      }
      return {
        codprd,
        cantidad,
        preuni: preuni === null || preuni === undefined ? null : Number(preuni),
      };
    });

    // Ejecuta todo en una sola transacción SQL (crear factura + líneas + opcional cerrar)
    const params: Record<string, any> = {
      codneg: dto.codneg,
      tipo,
      codcli: dto.codcli ?? null,
      codpro: dto.codpro ?? null,
      codusr: dto.codusr ?? null,
      usercrea: dto.usercrea ?? null,
      efectivo: dto.efectivo ?? null,
      // Nota: dto.autorizacion puede contener { codusr, auditId } si hubo autorización temporal para editar precios.
      // Persistir esta información requiere migración/tabla o extender SP. Actualmente la dejamos en params
      // para usarla en una futura migración que inserte el registro de autorización dentro de la transacción.
      autorizacion_codusr: dto.autorizacion?.codusr ?? null,
      autorizacion_auditid: dto.autorizacion?.auditId ?? null,
    };

    const parts: string[] = [];
    parts.push('SET NOCOUNT ON;');
    parts.push('BEGIN TRY');
    parts.push('  BEGIN TRAN;');
    parts.push('  DECLARE @codfac_out INT;');
    parts.push('  EXEC dbo.sp_factura_crear');
    parts.push('    @codneg = @codneg,');
    parts.push('    @tipo = @tipo,');
    parts.push('    @codcli = @codcli,');
    parts.push('    @codpro = @codpro,');
    parts.push('    @codusr = @codusr,');
    parts.push('    @usercrea = @usercrea,');
    parts.push('    @codfac_out = @codfac_out OUTPUT;');

    // Todas las líneas en UNA llamada (OPENJSON en el SP): operación de
    // conjunto en vez de N ejecuciones fila a fila.
    if (normItems.length) {
      params.lineas_json = JSON.stringify(normItems);
      parts.push('  EXEC dbo.sp_factura_detalle_agregar_batch');
      parts.push('    @tipo = @tipo,');
      parts.push('    @codfac = @codfac_out,');
      parts.push('    @lineas_json = @lineas_json,');
      parts.push('    @usercrea = @usercrea;');
    }

    if (dto.cerrar) {
      params.fiada = dto.fiar ? 1 : 0;
      parts.push('  EXEC dbo.sp_factura_cerrar @tipo = @tipo, @codfac = @codfac_out, @codusr = @codusr, @usercrea = @usercrea, @fiada = @fiada;');
    }

    if (dto.efectivo !== undefined && dto.efectivo !== null) {
      parts.push('  UPDATE dbo.facturas');
      parts.push('    SET efectivo_fac = @efectivo,');
      parts.push('        usermod = @usercrea,');
      parts.push('        fechmod = GETDATE()');
      parts.push('  WHERE tipo_fac = @tipo AND codfac_fac = @codfac_out;');
    }

    // Registrar autorización si viene información
    if (dto.autorizacion?.codusr) {
      parts.push('  IF @autorizacion_codusr IS NOT NULL');
      parts.push('  BEGIN');
      parts.push('    INSERT INTO dbo.facturas_autorizaciones (tipo_fac_aut, codfac_aut, codusr_aut, codper_aut, permiso_aut, fecha_aut, usercrea)');
      parts.push('    VALUES (@tipo, @codfac_out, @autorizacion_codusr, @autorizacion_auditid, N\'FACTURAS.MODIFICAR_PRECIO\', GETDATE(), @usercrea);');
      parts.push('  END');
    }

    parts.push('  COMMIT;');
    parts.push('  SELECT @codfac_out AS codfac;');
    parts.push('END TRY');
    parts.push('BEGIN CATCH');
    parts.push('  IF @@TRANCOUNT > 0 ROLLBACK;');
    parts.push('  THROW;');
    parts.push('END CATCH');

    // Fiar exige cliente identificado (a quién se le cobra) y cierre inmediato.
    if (dto.fiar) {
      if (tipo !== 'venta') throw new BadRequestException('Solo se pueden fiar ventas');
      if (!dto.codcli) throw new BadRequestException('Para fiar debes seleccionar el cliente');
      if (!dto.cerrar) throw new BadRequestException('El fiao requiere cerrar la factura');
    }

    // Fondo diario: solo ventas con cliente identificado.
    const fondoAplicar = Number(dto.fondoAplicar ?? 0);
    if (fondoAplicar > 0) {
      if (tipo !== 'venta') throw new BadRequestException('El fondo solo aplica a ventas');
      if (!dto.codcli) throw new BadRequestException('Para usar el fondo debes seleccionar el cliente');
    }

    try {
      const rows = await this.sql.executeQueryParams(parts.join('\n'), params);
      const codfac = rows?.[0]?.codfac;
      if (!codfac) throw new BadRequestException('No se pudo crear la factura');
      const resultado: any = await this.obtener(Number(codfac), dto.codneg, tipo);
      const total = Number(resultado?.factura?.total ?? 0);

      // Consumir fondo (valida saldo/adelanto; si la factura va fiada,
      // la parte de fondo se contabiliza como ingreso de hoy).
      if (fondoAplicar > 0) {
        const aplicado = Math.min(fondoAplicar, total);
        if (aplicado > 0) {
          await this.fondos.consumir({
            codneg: dto.codneg,
            codcli: Number(dto.codcli),
            monto: aplicado,
            tipo,
            codfac: Number(codfac),
            adelantar: Boolean(dto.fondoAdelantar),
            facturaFiada: Boolean(dto.fiar),
            codusr: dto.codusr ?? null,
            usercrea: dto.usercrea ?? null,
          });
        }
      }

      // Registrar la deuda (fiao): lo que no cubren ni el fondo ni el efectivo.
      if (dto.fiar) {
        const maxDeuda = total - Math.min(fondoAplicar, total);
        const deuda = dto.fiarMonto !== undefined && dto.fiarMonto !== null
          ? Math.round(Number(dto.fiarMonto) * 100) / 100
          : maxDeuda;
        if (deuda > maxDeuda + 0.005) {
          throw new BadRequestException(
            `El monto a fiar (${deuda.toFixed(2)}) excede lo pendiente de la factura (${maxDeuda.toFixed(2)}).`,
          );
        }
        if (deuda > 0) {
          await this.fiaos.crear({
            codneg: dto.codneg,
            codcli: Number(dto.codcli),
            tipo,
            codfac: Number(codfac),
            monto: deuda,
            codusr: dto.codusr ?? null,
            usercrea: dto.usercrea ?? null,
          });
        }
      }

      return resultado;
    } catch (e: any) {
      throw new BadRequestException(this.formatError(e));
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
      const tipo = this.normalizeTipo(dto.tipo ?? '');
      const meta = await this.obtenerMeta(dto.codfac, tipo);

      let preuni = dto.preuni;
      if (preuni === null) {
        // Si no viene precio, usar el precio del producto (venta) o precio_compra (compra).
        const priceRows = await this.sql.executeQueryParams(
          `
            SELECT TOP 1
              pd.precio_pdt AS precio,
              pd.precio_compra_pdt AS precio_compra
            FROM dbo.producto_det pd
            WHERE pd.codprd_pdt = @codprd
            ORDER BY pd.codpdt_pdt DESC;
          `,
          { codprd: dto.codprd },
        );
        const row = priceRows?.[0];
        const picked =
          meta.tipo === 'compra'
            ? (row?.precio_compra ?? row?.precio ?? 0)
            : (row?.precio ?? 0);
        preuni = Number(picked ?? 0);
      }

      if (preuni === null || !Number.isFinite(Number(preuni)) || Number(preuni) < 0) {
        throw new BadRequestException('preuni inválido');
      }

      const query = `
                DECLARE @codfdt_out INT;
                EXEC dbo.sp_factura_detalle_agregar
                  @tipo = @tipo,
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
        tipo,
        codprd: dto.codprd,
        cantidad: dto.cantidad,
        preuni,
        usercrea: dto.usercrea ?? null,
      });

      const codfdt = rows?.[0]?.codfdt;
      if (!codfdt) {
        throw new BadRequestException('No se pudo agregar el detalle');
      }

      return await this.obtener(dto.codfac, meta.codneg, tipo);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async cerrar(codfac: number, tipo: string, codusr?: string, usercrea?: number) {
    if (!codfac) {
      throw new BadRequestException('codfac es requerido');
    }

    const tipoValue = this.normalizeTipo(tipo);

    try {
      await this.sql.executeQueryParams(
        `EXEC dbo.sp_factura_cerrar @tipo = @tipo, @codfac = @codfac, @codusr = @codusr, @usercrea = @usercrea;`,
        {
          tipo: tipoValue,
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

  /**
   * Cierra varias facturas abiertas en una pasada. Si se entrega `codfacs`
   * cierra esa selección; si no, cierra TODAS las abiertas que cumplan el
   * filtro (tipo/rango de fechas). Cada cierre dispara la contabilización
   * automática del SP. Devuelve resumen y errores por factura.
   */
  async cerrarLote(dto: {
    codneg: number;
    tipo?: string | null;
    desde?: Date | null;
    hasta?: Date | null;
    codfacs?: Array<{ codfac: number; tipo: string }> | null;
    codusr?: string | null;
    usercrea?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');

    let objetivos: Array<{ codfac: number; tipo: string }> = [];
    if (dto.codfacs && dto.codfacs.length) {
      objetivos = dto.codfacs.map((f) => ({
        codfac: Number(f.codfac),
        tipo: this.normalizeTipo(f.tipo),
      }));
    } else {
      const abiertas: any[] = await this.listar({
        codneg: dto.codneg,
        tipo: dto.tipo ?? null,
        estado: 'abierta',
        desde: dto.desde ?? null,
        hasta: dto.hasta ?? null,
        limit: 500,
      });
      objetivos = (abiertas ?? []).map((r) => ({
        codfac: Number(r.codfac),
        tipo: String(r.tipo),
      }));
    }

    let cerradas = 0;
    const errores: Array<{ codfac: number; tipo: string; error: string }> = [];

    for (const o of objetivos) {
      try {
        await this.sql.executeQueryParams(
          `EXEC dbo.sp_factura_cerrar @tipo = @tipo, @codfac = @codfac, @codusr = @codusr, @usercrea = @usercrea;`,
          {
            tipo: o.tipo,
            codfac: o.codfac,
            codusr: dto.codusr ?? null,
            usercrea: dto.usercrea ?? null,
          },
        );
        cerradas++;
      } catch (error) {
        errores.push({
          codfac: o.codfac,
          tipo: o.tipo,
          error: this.formatError(error),
        });
      }
    }

    return { cerradas, intentadas: objetivos.length, errores };
  }

  async obtener(codfac: number, codneg?: number, tipo?: string | null) {
    if (!codfac) {
      throw new BadRequestException('codfac es requerido');
    }

    try {
      const meta = await this.obtenerMeta(codfac, tipo ?? null);
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
            f.codusr_fac AS codusr,
            CONCAT(ISNULL(pcli.nombre_per, ''), CASE WHEN pcli.apellidos_per IS NULL OR LTRIM(RTRIM(pcli.apellidos_per)) = '' THEN '' ELSE CONCAT(' ', pcli.apellidos_per) END) AS cliente_nombre,
            CONCAT(ISNULL(ppro.nombre_per, ''), CASE WHEN ppro.apellidos_per IS NULL OR LTRIM(RTRIM(ppro.apellidos_per)) = '' THEN '' ELSE CONCAT(' ', ppro.apellidos_per) END) AS proveedor_nombre
          FROM dbo.facturas f
          LEFT JOIN dbo.clientes c ON c.codcli_cli = f.codcli_fac
          LEFT JOIN dbo.personas pcli ON pcli.codper_per = c.codper_cli
          LEFT JOIN dbo.proveedores pr ON pr.codpro_pro = f.codpro_fac
          LEFT JOIN dbo.personas ppro ON ppro.codper_per = pr.codper_pro
          WHERE f.codfac_fac = @codfac
            AND f.tipo_fac = @tipo
            ${whereCodneg};
        `,
        { codfac, tipo: meta.tipo, codneg: codneg ?? null },
      );

      const factura = facturaRows?.[0];
      if (!factura) throw new NotFoundException('Factura no encontrada');

      const detalle = await this.sql.executeQueryParams(
        `
          SELECT
            fd.codfdt_fdt AS codfdt,
            fd.codfac_fdt AS codfac,
            fd.codprd_fdt AS codprd,
            p.nombre_prd AS producto_nombre,
            p.codigo_prd AS codigo,
            fd.cantidad_fdt AS cantidad,
            fd.preuni_fdt AS precio,
            fd.subtotal_fdt AS subtotal
          FROM dbo.factura_detalle fd
          INNER JOIN dbo.producto p ON p.codprd_prd = fd.codprd_fdt
          WHERE fd.tipo_fac_fdt = @tipo
            AND fd.codfac_fdt = @codfac
          ORDER BY fd.codfdt_fdt;
        `,
        { codfac, tipo: meta.tipo },
      );



      return { factura, detalle };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(this.formatError(error));
    }
  }

  async eliminar(codfac: number, tipo: string, codusr?: string | null) {
    const tipoValue = this.normalizeTipo(tipo);
    const meta = await this.obtenerMeta(codfac, tipoValue);
    if (meta.estado === 'cerrada') {
      throw new BadRequestException('No se puede eliminar una factura cerrada.');
    }
    try {
      await this.sql.executeQueryParams(
        `DELETE FROM dbo.factura_detalle WHERE codfac_fdt = @codfac AND tipo_fac_fdt = @tipo;
         DELETE FROM dbo.facturas WHERE codfac_fac = @codfac AND tipo_fac = @tipo;`,
        { codfac, tipo: tipoValue },
      );
      return { ok: true };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }
}
