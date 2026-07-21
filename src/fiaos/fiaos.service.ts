import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

/**
 * FIAO (ventas a crédito): deudas de clientes y abonos parciales.
 * El ingreso contable se registra al ABONAR (dinero real entrando a caja).
 */
@Injectable()
export class FiaosService {
  constructor(private readonly sql: SqlService) {}

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación.'
    );
  }

  /** Crea el fiao de una factura recién cerrada (llamado desde facturación). */
  async crear(dto: {
    codneg: number;
    codcli: number;
    tipo: string;
    codfac: number;
    monto: number;
    codusr?: string | null;
    usercrea?: number | null;
  }) {
    if (!dto.codneg || !dto.codcli || !dto.codfac || !(dto.monto > 0)) {
      throw new BadRequestException('Datos de fiao incompletos');
    }

    // El cliente debe tener el fiao permitido y no exceder su límite de deuda.
    const chk = await this.sql.executeQueryParams(
      `SELECT c.fiar_cli AS fiar, c.limite_fiado_cli AS limite,
              (SELECT ISNULL(SUM(f.saldo_fia), 0) FROM dbo.fiaos f
                WHERE f.codcli_fia = c.codcli_cli AND f.codneg_fia = @codneg
                  AND f.estado_fia IN ('pendiente','parcial')) AS deuda
       FROM dbo.clientes c
       WHERE c.codcli_cli = @codcli AND c.codneg_cli = @codneg;`,
      { codcli: dto.codcli, codneg: dto.codneg },
    );
    const cli = chk?.[0];
    if (!cli) throw new BadRequestException('Cliente no existe en este negocio');
    if (!Number(cli.fiar)) {
      throw new BadRequestException('A este cliente no se le puede fiar (actívalo en Catálogos → Clientes).');
    }
    if (cli.limite !== null && cli.limite !== undefined) {
      const limite = Number(cli.limite);
      const deuda = Number(cli.deuda);
      if (deuda + Number(dto.monto) > limite + 0.005) {
        const capacidad = Math.max(0, limite - deuda);
        throw new BadRequestException(
          `Excede el límite de fiado del cliente (límite ${limite.toFixed(2)}, debe ${deuda.toFixed(2)}, puede fiar hasta ${capacidad.toFixed(2)}).`,
        );
      }
    }

    const rows = await this.sql.executeQueryParams(
      `INSERT INTO dbo.fiaos (codneg_fia, codcli_fia, tipo_fac_fia, codfac_fia, monto_fia, saldo_fia, codusr_fia, usercrea)
       OUTPUT INSERTED.codfia AS codfia
       VALUES (@codneg, @codcli, @tipo, @codfac, @monto, @monto, @codusr, @usercrea);`,
      {
        codneg: dto.codneg,
        codcli: dto.codcli,
        tipo: dto.tipo,
        codfac: dto.codfac,
        monto: dto.monto,
        codusr: dto.codusr ?? null,
        usercrea: dto.usercrea ?? null,
      },
    );
    return rows?.[0] ?? null;
  }

  /** Lista fiaos del negocio con datos del cliente y lo abonado. */
  async listar(dto: { codneg: number; estado?: string | null }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');
    const estado = ['pendiente', 'parcial', 'pagado'].includes(String(dto.estado))
      ? String(dto.estado)
      : null;
    return await this.sql.executeQueryParams(
      `
      SELECT f.codfia, f.codcli_fia AS codcli, f.tipo_fac_fia AS tipo, f.codfac_fia AS codfac,
             f.monto_fia AS monto, f.saldo_fia AS saldo, f.estado_fia AS estado,
             f.codusr_fia AS codusr, f.fechcrea AS fecha,
             CONCAT(p.nombre_per, ' ', ISNULL(p.apellidos_per, '')) AS cliente_nombre,
             (SELECT ISNULL(SUM(a.monto_abo), 0) FROM dbo.fiao_abonos a WHERE a.codfia_abo = f.codfia) AS abonado
      FROM dbo.fiaos f
      INNER JOIN dbo.clientes c ON c.codcli_cli = f.codcli_fia
      INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
      WHERE f.codneg_fia = @codneg
        AND (@estado IS NULL OR f.estado_fia = @estado)
      ORDER BY CASE f.estado_fia WHEN 'pendiente' THEN 0 WHEN 'parcial' THEN 1 ELSE 2 END, f.fechcrea DESC;
      `,
      { codneg: dto.codneg, estado },
    );
  }

  /** Detalle de un fiao con su historial de abonos. */
  async obtener(codfia: number, codneg: number) {
    const cab = await this.sql.executeQueryParams(
      `SELECT f.codfia, f.codneg_fia AS codneg, f.codcli_fia AS codcli,
              f.tipo_fac_fia AS tipo, f.codfac_fia AS codfac,
              f.monto_fia AS monto, f.saldo_fia AS saldo, f.estado_fia AS estado,
              f.codusr_fia AS codusr, f.fechcrea AS fecha,
              CONCAT(p.nombre_per, ' ', ISNULL(p.apellidos_per, '')) AS cliente_nombre
       FROM dbo.fiaos f
       INNER JOIN dbo.clientes c ON c.codcli_cli = f.codcli_fia
       INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
       WHERE f.codfia = @codfia AND f.codneg_fia = @codneg;`,
      { codfia, codneg },
    );
    if (!cab?.[0]) throw new BadRequestException('Fiao no existe');
    const abonos = await this.sql.executeQueryParams(
      `SELECT codabo, monto_abo AS monto, codusr_abo AS codusr, nota_abo AS nota, fechcrea AS fecha
       FROM dbo.fiao_abonos WHERE codfia_abo = @codfia ORDER BY fechcrea DESC;`,
      { codfia },
    );
    return { ...cab[0], abonos: abonos ?? [] };
  }

  /**
   * Registra un abono (parcial o total): baja el saldo, actualiza el estado
   * y CONTABILIZA el ingreso (aquí es cuando entra dinero real).
   */
  async abonar(dto: {
    codfia: number;
    codneg: number;
    monto: number;
    nota?: string | null;
    codusr?: string | null;
    usercrea?: number | null;
  }) {
    const monto = Number(dto.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('El monto del abono debe ser mayor que 0');
    }

    try {
      const rows = await this.sql.executeQueryParams(
        `
        SET NOCOUNT ON;
        BEGIN TRY
          BEGIN TRAN;

          DECLARE @saldo decimal(18,2), @codcli int, @codfac int;
          SELECT @saldo = saldo_fia, @codcli = codcli_fia, @codfac = codfac_fia
          FROM dbo.fiaos WITH (UPDLOCK, HOLDLOCK)
          WHERE codfia = @codfia AND codneg_fia = @codneg AND estado_fia <> 'pagado';

          IF @saldo IS NULL
            THROW 50400, N'Fiao no existe o ya está pagado.', 1;
          IF @monto > @saldo
            THROW 50401, N'El abono excede el saldo pendiente.', 1;

          INSERT INTO dbo.fiao_abonos (codfia_abo, monto_abo, codusr_abo, nota_abo, usercrea)
          VALUES (@codfia, @monto, @codusr, @nota, @usercrea);

          DECLARE @codabo int = SCOPE_IDENTITY();
          DECLARE @nuevoSaldo decimal(18,2) = @saldo - @monto;

          UPDATE dbo.fiaos
            SET saldo_fia = @nuevoSaldo,
                estado_fia = CASE WHEN @nuevoSaldo <= 0 THEN 'pagado' ELSE 'parcial' END,
                usermod = @usercrea, fechmod = GETDATE()
          WHERE codfia = @codfia;

          -- Ingreso contable: ahora sí entra dinero real.
          DECLARE @codcta int, @coding int;
          EXEC dbo.sp_contabilidad_cuenta_resolver
            @codneg = @codneg, @concepto = 'venta', @usercrea = @usercrea, @codcta_out = @codcta OUTPUT;

          DECLARE @refdoc nvarchar(50) = N'fiao-' + CAST(@codfia AS nvarchar(20)) + N'-abo-' + CAST(@codabo AS nvarchar(20));
          DECLARE @descri nvarchar(255) = N'Abono fiao #' + CAST(@codfia AS nvarchar(20)) + N' (factura venta-' + CAST(@codfac AS nvarchar(20)) + N')';

          EXEC dbo.sp_ingreso_registrar
            @codneg = @codneg, @codcta = @codcta, @monto = @monto,
            @descri = @descri, @refdoc = @refdoc,
            @codusr = @codusr, @usercrea = @usercrea, @coding_out = @coding OUTPUT;

          COMMIT;

          SELECT @codabo AS codabo, @nuevoSaldo AS saldo,
                 CASE WHEN @nuevoSaldo <= 0 THEN 'pagado' ELSE 'parcial' END AS estado;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK;
          THROW;
        END CATCH
        `,
        {
          codfia: dto.codfia,
          codneg: dto.codneg,
          monto,
          nota: dto.nota ?? null,
          codusr: dto.codusr ?? null,
          usercrea: dto.usercrea ?? null,
        },
      );
      return rows?.[0] ?? { ok: true };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /** Saldo pendiente total por cliente (para la pantalla y para facturación). */
  async saldosPorCliente(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    return await this.sql.executeQueryParams(
      `
      SELECT f.codcli_fia AS codcli,
             CONCAT(p.nombre_per, ' ', ISNULL(p.apellidos_per, '')) AS cliente_nombre,
             SUM(f.saldo_fia) AS saldo_total,
             COUNT(*) AS fiaos_abiertos
      FROM dbo.fiaos f
      INNER JOIN dbo.clientes c ON c.codcli_cli = f.codcli_fia
      INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
      WHERE f.codneg_fia = @codneg AND f.estado_fia <> 'pagado'
      GROUP BY f.codcli_fia, p.nombre_per, p.apellidos_per
      ORDER BY saldo_total DESC;
      `,
      { codneg },
    );
  }
}
