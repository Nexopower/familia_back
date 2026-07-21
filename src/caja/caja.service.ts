import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';
import { FacturasService } from 'src/facturas/facturas.service';
import {
  construirConteo,
  calcularTotales,
  calcularCierre,
  type ConteoLinea,
} from './caja.calc';

type TipoCaja = 'apertura' | 'cierre' | 'conteo_parcial';

@Injectable()
export class CajaService {
  constructor(
    private readonly sql: SqlService,
    private readonly facturas: FacturasService,
  ) {}

  private hoyDateOnly(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación de caja.'
    );
  }

  /* ── Configuración ── */
  async getConfig(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    try {
      const rows = await this.sql.executeQueryParams(
        `SELECT fondo_billetes_ccj   AS fondoBilletes,
                monedas_modo_ccj     AS monedasModo,
                monedas_fijo_ccj     AS monedasFijo,
                impresora_ip_ccj     AS impresoraIp,
                impresora_puerto_ccj AS impresoraPuerto,
                impresora_modo_ccj   AS impresoraModo,
                impresora_usb_ccj    AS impresoraUsb
         FROM dbo.caja_config WHERE codneg_ccj = @codneg;`,
        { codneg },
      );
      const r = rows?.[0];
      return {
        fondoBilletes: Number(r?.fondoBilletes ?? 500),
        monedasModo: (r?.monedasModo ?? 'todas') as 'todas' | 'fijo',
        monedasFijo: r?.monedasFijo == null ? null : Number(r.monedasFijo),
        impresoraIp: r?.impresoraIp ? String(r.impresoraIp) : null,
        impresoraPuerto: r?.impresoraPuerto == null ? null : Number(r.impresoraPuerto),
        impresoraModo: (r?.impresoraModo ?? (r?.impresoraIp ? 'red' : 'usb')) as 'red' | 'usb',
        impresoraUsb: r?.impresoraUsb ? String(r.impresoraUsb) : null,
      };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async saveConfig(dto: {
    codneg: number;
    fondoBilletes: number;
    monedasModo: 'todas' | 'fijo';
    monedasFijo?: number | null;
    impresoraIp?: string | null;
    impresoraPuerto?: number | null;
    impresoraModo?: 'red' | 'usb' | null;
    impresoraUsb?: string | null;
    usermod?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    const modo = dto.monedasModo === 'fijo' ? 'fijo' : 'todas';
    const impModo = dto.impresoraModo === 'red' ? 'red' : dto.impresoraModo === 'usb' ? 'usb' : null;
    try {
      await this.sql.executeQueryParams(
        `MERGE dbo.caja_config AS t
         USING (SELECT @codneg AS codneg) AS s ON t.codneg_ccj = s.codneg
         WHEN MATCHED THEN UPDATE SET
            fondo_billetes_ccj   = @fondo,
            monedas_modo_ccj     = @modo,
            monedas_fijo_ccj     = @fijo,
            impresora_ip_ccj     = @impIp,
            impresora_puerto_ccj = @impPuerto,
            impresora_modo_ccj   = @impModo,
            impresora_usb_ccj    = @impUsb,
            usermod = @usermod, fechmod = GETDATE()
         WHEN NOT MATCHED THEN
            INSERT (codneg_ccj, fondo_billetes_ccj, monedas_modo_ccj, monedas_fijo_ccj, impresora_ip_ccj, impresora_puerto_ccj, impresora_modo_ccj, impresora_usb_ccj, usermod)
            VALUES (@codneg, @fondo, @modo, @fijo, @impIp, @impPuerto, @impModo, @impUsb, @usermod);`,
        {
          codneg: dto.codneg,
          fondo: Number(dto.fondoBilletes ?? 500),
          modo,
          fijo: modo === 'fijo' ? Number(dto.monedasFijo ?? 0) : null,
          impIp: dto.impresoraIp?.trim() || null,
          impPuerto: dto.impresoraPuerto == null ? null : Number(dto.impresoraPuerto),
          impModo,
          impUsb: dto.impresoraUsb?.trim() || null,
          usermod: dto.usermod ?? null,
        },
      );
      return await this.getConfig(dto.codneg);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /* ── Estado actual ── */
  async estado(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    try {
      const [aperturas, cierres, config] = await Promise.all([
        this.sql.executeQueryParams(
          `SELECT TOP 1 codcaj_caj AS codcaj, fecha_caj AS fecha, total_general_caj AS total, turno_caj AS turno
           FROM dbo.caja_registros WHERE codneg_caj = @codneg AND tipo_caj = 'apertura'
           ORDER BY codcaj_caj DESC;`,
          { codneg },
        ),
        this.sql.executeQueryParams(
          `SELECT TOP 1 codcaj_caj AS codcaj, fecha_caj AS fecha,
                  ISNULL(billetes_dejar_caj,0) + ISNULL(monedas_dejar_caj,0) AS fondoResultante,
                  monto_retirado_caj AS retirado
           FROM dbo.caja_registros WHERE codneg_caj = @codneg AND tipo_caj = 'cierre'
           ORDER BY codcaj_caj DESC;`,
          { codneg },
        ),
        this.getConfig(codneg),
      ]);

      const ultimaApertura = aperturas?.[0] ?? null;
      const ultimoCierre = cierres?.[0] ?? null;
      const cajaAbierta = Boolean(
        ultimaApertura &&
          (!ultimoCierre ||
            Number(ultimaApertura.codcaj) > Number(ultimoCierre.codcaj)),
      );
      const fondoEsperado = ultimoCierre
        ? Number(ultimoCierre.fondoResultante ?? 0)
        : Number(config.fondoBilletes ?? 0);

      return { cajaAbierta, ultimaApertura, ultimoCierre, fondoEsperado, config };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /* ── Registrar apertura / conteo / cierre ── */
  async registrar(dto: {
    codneg: number;
    tipo: TipoCaja;
    turno?: string | null;
    cantidades: Record<number, number>;
    monedasModo?: 'todas' | 'fijo';
    monedasFijo?: number | null;
    notas?: string | null;
    codusr?: string | null;
    usercrea?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    if (!['apertura', 'cierre', 'conteo_parcial'].includes(dto.tipo)) {
      throw new BadRequestException('tipo de registro inválido');
    }

    const lineas: ConteoLinea[] = construirConteo(dto.cantidades);
    const totales = calcularTotales(lineas);

    let monedasDejar: number | null = null;
    let billetesDejar: number | null = null;
    let montoRetirado: number | null = null;

    if (dto.tipo === 'cierre') {
      const cfg = await this.getConfig(dto.codneg);
      const modo = dto.monedasModo ?? cfg.monedasModo;
      const fijo = dto.monedasFijo ?? cfg.monedasFijo;
      const cierre = calcularCierre({
        lineas,
        fondoBilletes: cfg.fondoBilletes,
        monedasModo: modo,
        monedasFijo: fijo,
      });
      if (totales.totalGeneral < cierre.billetesDejar + cierre.monedasDejar) {
        throw new BadRequestException(
          'No se puede cerrar: el efectivo contado es menor que el fondo a dejar.',
        );
      }
      monedasDejar = cierre.monedasDejar;
      billetesDejar = cierre.billetesDejar;
      montoRetirado = cierre.montoRetirar;
    }

    try {
      // Inserta cabecera y devuelve el id, luego inserta el detalle.
      const headRows = await this.sql.executeQueryParams(
        `INSERT INTO dbo.caja_registros
           (codneg_caj, tipo_caj, turno_caj, total_billetes_caj, total_monedas_caj,
            total_general_caj, monedas_dejar_caj, billetes_dejar_caj, monto_retirado_caj,
            notas_caj, codusr_caj, usercrea)
         OUTPUT INSERTED.codcaj_caj AS codcaj
         VALUES (@codneg, @tipo, @turno, @tb, @tm, @tg, @mdej, @bdej, @ret, @notas, @codusr, @usercrea);`,
        {
          codneg: dto.codneg,
          tipo: dto.tipo,
          turno: dto.turno ?? null,
          tb: totales.totalBilletes,
          tm: totales.totalMonedas,
          tg: totales.totalGeneral,
          mdej: monedasDejar,
          bdej: billetesDejar,
          ret: montoRetirado,
          notas: dto.notas ?? null,
          codusr: dto.codusr ?? null,
          usercrea: dto.usercrea ?? null,
        },
      );

      const codcaj = Number(headRows?.[0]?.codcaj);
      if (!codcaj) throw new BadRequestException('No se pudo registrar la caja');

      // Detalle: una fila por denominación con cantidad > 0.
      const conCantidad = lineas.filter((l) => l.cantidad > 0);
      if (conCantidad.length) {
        const valores: string[] = [];
        const params: Record<string, any> = { codcaj };
        conCantidad.forEach((l, i) => {
          params[`den_${i}`] = l.valor;
          params[`mon_${i}`] = l.esMoneda ? 1 : 0;
          params[`can_${i}`] = l.cantidad;
          params[`sub_${i}`] = l.subtotal;
          valores.push(
            `(@codcaj, @den_${i}, @mon_${i}, @can_${i}, @sub_${i})`,
          );
        });
        await this.sql.executeQueryParams(
          `INSERT INTO dbo.caja_registro_det
             (codcaj_cjd, denominacion_cjd, es_moneda_cjd, cantidad_cjd, subtotal_cjd)
           VALUES ${valores.join(', ')};`,
          params,
        );
      }

      // Al cerrar la caja, cerrar también las facturas abiertas de HOY
      // (genera su contabilización automática).
      let facturasCerradas: { cerradas: number; intentadas: number; errores: any[] } | null = null;
      if (dto.tipo === 'cierre') {
        const hoy = this.hoyDateOnly();
        facturasCerradas = await this.facturas.cerrarLote({
          codneg: dto.codneg,
          desde: new Date(hoy),
          hasta: new Date(hoy),
          codusr: dto.codusr ?? null,
          usercrea: dto.usercrea ?? null,
        });
      }

      return {
        codcaj,
        tipo: dto.tipo,
        ...totales,
        monedasDejar,
        billetesDejar,
        montoRetirado,
        facturasCerradas,
      };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /* ── Historial ── */
  async historial(dto: {
    codneg: number;
    tipo?: string | null;
    desde?: Date | null;
    hasta?: Date | null;
    limit?: number | null;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    const limit = Math.min(Math.max(Number(dto.limit ?? 100), 1), 500);
    try {
      return await this.sql.executeQueryParams(
        `SELECT TOP (@limit)
            codcaj_caj AS codcaj, tipo_caj AS tipo, fecha_caj AS fecha, turno_caj AS turno,
            total_billetes_caj AS totalBilletes, total_monedas_caj AS totalMonedas,
            total_general_caj AS totalGeneral, monedas_dejar_caj AS monedasDejar,
            billetes_dejar_caj AS billetesDejar, monto_retirado_caj AS montoRetirado,
            notas_caj AS notas, codusr_caj AS codusr
         FROM dbo.caja_registros
         WHERE codneg_caj = @codneg
           AND (@tipo IS NULL OR tipo_caj = @tipo)
           AND (@desde IS NULL OR fecha_caj >= @desde)
           AND (@hasta IS NULL OR fecha_caj < DATEADD(DAY, 1, @hasta))
         ORDER BY codcaj_caj DESC;`,
        {
          codneg: dto.codneg,
          tipo: dto.tipo ?? null,
          desde: dto.desde ?? null,
          hasta: dto.hasta ?? null,
          limit,
        },
      );
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async obtener(codcaj: number, codneg: number) {
    if (!codcaj) throw new BadRequestException('codcaj es requerido');
    try {
      const cab = await this.sql.executeQueryParams(
        `SELECT codcaj_caj AS codcaj, codneg_caj AS codneg, tipo_caj AS tipo, fecha_caj AS fecha,
                turno_caj AS turno, total_billetes_caj AS totalBilletes, total_monedas_caj AS totalMonedas,
                total_general_caj AS totalGeneral, monedas_dejar_caj AS monedasDejar,
                billetes_dejar_caj AS billetesDejar, monto_retirado_caj AS montoRetirado, notas_caj AS notas
         FROM dbo.caja_registros WHERE codcaj_caj = @codcaj AND codneg_caj = @codneg;`,
        { codcaj, codneg },
      );
      if (!cab?.[0]) throw new BadRequestException('Registro de caja no existe');
      const detalle = await this.sql.executeQueryParams(
        `SELECT denominacion_cjd AS denominacion, es_moneda_cjd AS esMoneda,
                cantidad_cjd AS cantidad, subtotal_cjd AS subtotal
         FROM dbo.caja_registro_det WHERE codcaj_cjd = @codcaj
         ORDER BY es_moneda_cjd ASC, denominacion_cjd DESC;`,
        { codcaj },
      );
      return { ...cab[0], detalle: detalle ?? [] };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /** Para validar acceso al negocio del registro. */
  async codnegDeRegistro(codcaj: number): Promise<number> {
    const rows = await this.sql.executeQueryParams(
      `SELECT codneg_caj AS codneg FROM dbo.caja_registros WHERE codcaj_caj = @codcaj;`,
      { codcaj },
    );
    const codneg = Number(rows?.[0]?.codneg);
    if (!codneg) throw new BadRequestException('Registro de caja no existe');
    return codneg;
  }
}
