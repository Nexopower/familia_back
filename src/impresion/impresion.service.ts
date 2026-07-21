import { BadRequestException, Injectable } from '@nestjs/common';
import { Socket } from 'net';
import { execFile } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { SqlService } from 'src/sql/sql.service';
import { FacturasService } from 'src/facturas/facturas.service';

/**
 * Impresión directa a impresora térmica ESC/POS. Dos transportes:
 *  - 'red': TCP al puerto RAW (9100) de la impresora Ethernet.
 *  - 'usb': impresora COMPARTIDA de Windows — se copian los bytes en crudo
 *    con `copy /b archivo \\localhost\NOMBRE` (requiere compartir la
 *    impresora una vez: Propiedades → Compartir → ej. "POS80").
 * El backend arma el ticket y lo envía: sin diálogo del navegador.
 * La configuración es por negocio (caja_config).
 */

const ANCHO = 48; // caracteres por línea (fontA en 80mm)

// ESC/POS
const INIT = Buffer.from([0x1b, 0x40]);
const FONT_A = Buffer.from([0x1b, 0x4d, 0x00]); // fija fuente A (48 col) explícitamente
const CENTRAR = Buffer.from([0x1b, 0x61, 0x01]);
const IZQUIERDA = Buffer.from([0x1b, 0x61, 0x00]);
const NEGRITA_ON = Buffer.from([0x1b, 0x45, 0x01]);
const NEGRITA_OFF = Buffer.from([0x1b, 0x45, 0x00]);
const DOBLE_ON = Buffer.from([0x1d, 0x21, 0x11]);
const ALTO_DOBLE_ON = Buffer.from([0x1d, 0x21, 0x01]); // doble alto, ancho normal (48 col)
const DOBLE_OFF = Buffer.from([0x1d, 0x21, 0x00]);
const CORTAR = Buffer.from([0x1d, 0x56, 0x42, 0x00]);
const ABRIR_CAJON = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

// Acentos españoles → CP437 (code page por defecto de la impresora).
const CP437: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3,
  ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a, É: 0x90,
  '¿': 0xa8, '¡': 0xad, '°': 0xf8,
  Á: 0x41, Í: 0x49, Ó: 0x4f, Ú: 0x55, // sin equivalente: mayúscula plana
};

function texto(s: string): Buffer {
  // Normaliza espacios "raros" de los locales (U+202F, U+00A0) que la
  // impresora no conoce y saldrían como '?'.
  const limpio = String(s ?? '').replace(/[    ]/g, ' ');
  const bytes: number[] = [];
  for (const ch of limpio) {
    if (CP437[ch] !== undefined) bytes.push(CP437[ch]);
    else {
      const code = ch.charCodeAt(0);
      bytes.push(code >= 0x20 && code < 0x7f ? code : ch === '\n' ? 0x0a : 0x3f);
    }
  }
  return Buffer.from(bytes);
}

/** Línea de dos columnas (izquierda + derecha) al ancho dado. */
function linea(izq: string, der: string, ancho: number = ANCHO): string {
  const espacio = ancho - izq.length - der.length;
  return espacio > 0 ? izq + ' '.repeat(espacio) + der : `${izq} ${der}`;
}

/** dd/mm/yyyy HH:MM sin depender del locale (evita U+202F de 'p. m.'). */
function fmtFechaHora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function separador(): string {
  return '-'.repeat(ANCHO);
}

function envolver(s: string, ancho: number): string[] {
  const out: string[] = [];
  let resto = String(s ?? '').trim();
  while (resto.length > ancho) {
    let corte = resto.lastIndexOf(' ', ancho);
    if (corte <= 0) corte = ancho;
    out.push(resto.slice(0, corte));
    resto = resto.slice(corte).trim();
  }
  if (resto) out.push(resto);
  return out;
}

function fmt(v: number): string {
  return Number(v ?? 0).toFixed(2);
}

@Injectable()
export class ImpresionService {
  constructor(
    private readonly sql: SqlService,
    private readonly facturas: FacturasService,
  ) {}

  private async printerConfig(codneg: number): Promise<
    | { modo: 'red'; ip: string; puerto: number }
    | { modo: 'usb'; unc: string }
  > {
    const rows = await this.sql.executeQueryParams(
      `SELECT impresora_ip_ccj AS ip, impresora_puerto_ccj AS puerto,
              impresora_modo_ccj AS modo, impresora_usb_ccj AS usb
       FROM dbo.caja_config WHERE codneg_ccj = @codneg;`,
      { codneg },
    );
    const r = rows?.[0] ?? {};
    const modo = String(r.modo ?? '').trim() || (r.ip ? 'red' : r.usb ? 'usb' : '');

    if (modo === 'usb') {
      const usb = String(r.usb ?? '').trim();
      if (!usb) {
        throw new BadRequestException(
          'IMPRESORA_NO_CONFIGURADA: define el nombre compartido de la impresora USB en Caja → Configuración.',
        );
      }
      // Acepta nombre compartido ("POS80") o UNC completo ("\\PC\POS80").
      const unc = usb.startsWith('\\\\') ? usb : `\\\\localhost\\${usb}`;
      return { modo: 'usb', unc };
    }

    const ip = String(r.ip ?? '').trim();
    if (!ip) {
      throw new BadRequestException(
        'IMPRESORA_NO_CONFIGURADA: configura la impresora (red o USB) en Caja → Configuración.',
      );
    }
    return { modo: 'red', ip, puerto: Number(r.puerto) || 9100 };
  }

  /** Despacha al transporte configurado. */
  private async despachar(
    cfg: { modo: 'red'; ip: string; puerto: number } | { modo: 'usb'; unc: string },
    data: Buffer,
  ): Promise<void> {
    if (cfg.modo === 'usb') return await this.enviarUSB(cfg.unc, data);
    return await this.enviarRed(cfg.ip, cfg.puerto, data);
  }

  /**
   * USB (Windows): copia los bytes en crudo a la impresora compartida.
   * Equivale a `copy /b ticket.bin \\localhost\POS80`.
   */
  private async enviarUSB(unc: string, data: Buffer): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'ticket-'));
    const file = join(dir, 'ticket.bin');
    try {
      await writeFile(file, data);
      await new Promise<void>((resolve, reject) => {
        execFile(
          'cmd.exe',
          ['/c', 'copy', '/b', file, unc],
          { timeout: 10000, windowsHide: true },
          (err, _stdout, stderr) => {
            if (err) {
              reject(
                new BadRequestException(
                  `No se pudo imprimir por USB en "${unc}". Verifica que la impresora esté compartida en Windows (Propiedades → Compartir). ${String(stderr ?? '').trim()}`,
                ),
              );
            } else {
              resolve();
            }
          },
        );
      });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Red: envía bytes crudos a la impresora por TCP (RAW 9100). */
  private enviarRed(ip: string, puerto: number, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let done = false;
      const fail = (msg: string) => {
        if (done) return;
        done = true;
        socket.destroy();
        reject(new BadRequestException(msg));
      };

      socket.setTimeout(5000);
      socket.on('timeout', () => fail(`No responde la impresora en ${ip}:${puerto} (timeout).`));
      socket.on('error', (e: any) => fail(`No se pudo conectar a la impresora ${ip}:${puerto} (${e?.code ?? e?.message}).`));
      socket.connect(puerto, ip, () => {
        socket.write(data, () => {
          socket.end();
          if (!done) {
            done = true;
            resolve();
          }
        });
      });
    });
  }

  /** Abre el cajón de dinero (pulso al RJ11 de la impresora), sin imprimir. */
  async abrirCajon(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    const cfg = await this.printerConfig(codneg);
    await this.despachar(cfg, Buffer.concat([INIT, ABRIR_CAJON]));
    return { ok: true };
  }

  /** Imprime el ticket de una factura y opcionalmente abre el cajón. */
  async imprimirFactura(dto: {
    codneg: number;
    codfac: number;
    tipo: string;
    abrirCajon?: boolean;
    montoPagado?: number | null;
    cambio?: number | null;
    fondoAplicado?: number | null;
    fiado?: number | null;
  }) {
    if (!dto.codneg || !dto.codfac) {
      throw new BadRequestException('codneg y codfac son requeridos');
    }
    const cfg = await this.printerConfig(dto.codneg);

    const data: any = await this.facturas.obtener(dto.codfac, dto.codneg, dto.tipo ?? null);
    const factura = data?.factura ?? data ?? {};
    const detalle: any[] = data?.detalle ?? [];

    const negRows = await this.sql.executeQueryParams(
      `SELECT nombre_neg AS nombre FROM dbo.negocios WHERE codneg_neg = @codneg;`,
      { codneg: dto.codneg },
    );
    const negocio = String(negRows?.[0]?.nombre ?? '');

    const fecha = factura?.fecha ? new Date(factura.fecha) : new Date();
    const esVenta = String(factura?.tipo ?? dto.tipo ?? 'venta') === 'venta';

    const partes: Buffer[] = [INIT, FONT_A];

    // Cabecera (línea en blanco tras el nombre: en doble alto puede pisar la siguiente)
    partes.push(CENTRAR, DOBLE_ON, NEGRITA_ON, texto(`${negocio}\n`), DOBLE_OFF, NEGRITA_OFF);
    partes.push(texto('\n'));
    partes.push(NEGRITA_ON, texto(`${esVenta ? 'FACTURA DE VENTA' : 'FACTURA DE COMPRA'} No. ${factura?.codfac ?? dto.codfac}\n`), NEGRITA_OFF);
    partes.push(texto(`Emision: ${fmtFechaHora(fecha)}\n`));
    const contraparte = esVenta
      ? (factura?.cliente_nombre || 'Consumidor final')
      : (factura?.proveedor_nombre || 'Proveedor general');
    partes.push(texto(`${esVenta ? 'Cliente' : 'Proveedor'}: ${contraparte}\n`));
    partes.push(IZQUIERDA, texto(separador() + '\n'));

    // Detalle
    partes.push(texto(linea('DESCRIPCION', 'SUBTOTAL') + '\n'));
    partes.push(texto(separador() + '\n'));
    let subtotal = 0;
    for (const l of detalle) {
      const nombre = String(l?.producto_nombre ?? l?.codprd ?? 'Producto');
      const cant = Number(l?.cantidad ?? 0);
      const precio = Number(l?.preuni ?? l?.precio ?? 0);
      const sub = Number(l?.subtotal ?? cant * precio);
      subtotal += sub;

      for (const ln of envolver(nombre, ANCHO)) partes.push(texto(ln + '\n'));
      if (l?.codigo) partes.push(texto(`  ${l.codigo}\n`));
      partes.push(texto(linea(`  ${cant} x ${fmt(precio)}`, fmt(sub)) + '\n'));
    }

    partes.push(texto(separador() + '\n'));

    // Totales
    const total = Number(factura?.total ?? subtotal);
    const impuestos = Math.max(0, total - subtotal);
    partes.push(texto(linea('Subtotal:', fmt(subtotal)) + '\n'));
    partes.push(texto(linea('Impuestos (IVA):', fmt(impuestos)) + '\n'));

    // Línea de "suma" bajo la columna de montos (separa impuestos del total).
    partes.push(texto(' '.repeat(ANCHO - 14) + '-'.repeat(14) + '\n'));

    // TOTAL en doble ALTO (ancho normal): resaltado sin ser gigante.
    partes.push(NEGRITA_ON, ALTO_DOBLE_ON, texto(linea('TOTAL:', fmt(total)) + '\n'), DOBLE_OFF, NEGRITA_OFF);

    const pagado = dto.montoPagado ?? factura?.efectivo ?? null;
    const fondoAplicado = Number(dto.fondoAplicado ?? 0);
    const fiado = Number(dto.fiado ?? 0);
    if (pagado !== null && pagado !== undefined) {
      // Aire + separador entre el total y la parte del pago.
      partes.push(texto('\n' + separador() + '\n'));
      // Desglose: fondo primero, luego lo fiado, luego el efectivo.
      if (fondoAplicado > 0) partes.push(texto(linea('Pagado con fondo:', fmt(fondoAplicado)) + '\n'));
      if (fiado > 0) partes.push(texto(linea('Fiado (a credito):', fmt(fiado)) + '\n'));
      partes.push(texto(linea(fondoAplicado > 0 || fiado > 0 ? 'Efectivo:' : 'Monto pagado:', fmt(Number(pagado))) + '\n'));
      const cambio = dto.cambio ?? Number(pagado) - (total - fondoAplicado - fiado);
      partes.push(texto(linea('Cambio:', fmt(Math.max(0, cambio))) + '\n'));
    }

    // Pie
    partes.push(texto(separador() + '\n'));
    partes.push(CENTRAR, NEGRITA_ON, texto('GRACIAS POR SU COMPRA\n'), NEGRITA_OFF);
    partes.push(texto(`Generada: ${fmtFechaHora(new Date())}\n`));
    partes.push(texto('\n\n\n'), CORTAR);

    if (dto.abrirCajon) partes.push(ABRIR_CAJON);

    await this.despachar(cfg, Buffer.concat(partes));
    return { ok: true };
  }
}
