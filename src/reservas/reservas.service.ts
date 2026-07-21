import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

interface CrearReservaDto {
  codneg: number;
  codcli: number;
  fecini: Date;
  fecfin: Date;
  detalle?: string;
  codusr?: string;
  usercrea?: number;
}

interface ReprogramarReservaDto {
  codres: number;
  fecini: Date;
  fecfin: Date;
  usercrea?: number;
}

@Injectable()
export class ReservasService {
  constructor(private readonly sql: SqlService) {}

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación.'
    );
  }

  async crear(dto: CrearReservaDto) {
    if (!dto.codneg || !dto.codcli || !dto.fecini || !dto.fecfin) {
      throw new BadRequestException(
        'codneg, codcli, fecini y fecfin son requeridos',
      );
    }

    try {
      const query = `
                DECLARE @codres_out INT;
                EXEC dbo.sp_reserva_crear
                    @codneg = @codneg,
                    @codcli = @codcli,
                    @fecini = @fecini,
                    @fecfin = @fecfin,
                    @detalle = @detalle,
                    @codusr = @codusr,
                    @usercrea = @usercrea,
                    @codres_out = @codres_out OUTPUT;
                SELECT @codres_out AS codres;
            `;

      const rows = await this.sql.executeQueryParams(query, {
        codneg: dto.codneg,
        codcli: dto.codcli,
        fecini: dto.fecini,
        fecfin: dto.fecfin,
        detalle: dto.detalle ?? null,
        codusr: dto.codusr ?? null,
        usercrea: dto.usercrea ?? null,
      });

      const codres = rows?.[0]?.codres;
      if (!codres) {
        throw new BadRequestException('No se pudo crear la reserva');
      }

      return await this.obtener(codres, dto.codneg);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async reprogramar(dto: ReprogramarReservaDto) {
    if (!dto.codres || !dto.fecini || !dto.fecfin) {
      throw new BadRequestException('codres, fecini y fecfin son requeridos');
    }

    try {
      await this.sql.executeQueryParams(
        `EXEC dbo.sp_reserva_reprogramar @codres = @codres, @fecini = @fecini, @fecfin = @fecfin, @usercrea = @usercrea;`,
        {
          codres: dto.codres,
          fecini: dto.fecini,
          fecfin: dto.fecfin,
          usercrea: dto.usercrea ?? null,
        },
      );

      return await this.obtener(dto.codres);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /** Edita los datos de una reserva (cliente, fechas, detalle). */
  async editar(dto: {
    codres: number;
    codcli: number;
    fecini: Date;
    fecfin: Date;
    detalle?: string | null;
    usermod?: number | null;
  }) {
    if (!dto.codres || !dto.codcli || !dto.fecini || !dto.fecfin) {
      throw new BadRequestException('codres, codcli, fecini y fecfin son requeridos');
    }
    if (dto.fecini >= dto.fecfin) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }
    try {
      await this.sql.executeQueryParams(
        `UPDATE dbo.reservas
            SET codcli_res = @codcli,
                fecini_res = @fecini,
                fecfin_res = @fecfin,
                detalle_res = @detalle,
                usermod = @usermod,
                fechmod = GETDATE()
          WHERE codres_res = @codres;`,
        {
          codres: dto.codres,
          codcli: dto.codcli,
          fecini: dto.fecini,
          fecfin: dto.fecfin,
          detalle: dto.detalle ?? null,
          usermod: dto.usermod ?? null,
        },
      );
      return await this.obtener(dto.codres);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /** Cambia el estado de la reserva (completada / cancelada / pendiente / confirmada). */
  async cambiarEstado(dto: { codres: number; estado: string; usermod?: number | null }) {
    const estados = ['pendiente', 'confirmada', 'completada', 'cancelada'];
    if (!dto.codres || !estados.includes(dto.estado)) {
      throw new BadRequestException('codres y un estado válido son requeridos');
    }
    try {
      await this.sql.executeQueryParams(
        `UPDATE dbo.reservas
            SET estado_res = @estado, usermod = @usermod, fechmod = GETDATE()
          WHERE codres_res = @codres;`,
        { codres: dto.codres, estado: dto.estado, usermod: dto.usermod ?? null },
      );
      return await this.obtener(dto.codres);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /** Devuelve el codneg de una reserva (para validar acceso). */
  async codnegDeReserva(codres: number): Promise<number> {
    const rows = await this.sql.executeQueryParams(
      `SELECT codneg_res AS codneg FROM dbo.reservas WHERE codres_res = @codres;`,
      { codres },
    );
    const codneg = Number(rows?.[0]?.codneg);
    if (!codneg) throw new NotFoundException('Reserva no encontrada');
    return codneg;
  }

  async listar(codneg: number, desde?: Date | null, hasta?: Date | null) {
    if (!codneg) {
      throw new BadRequestException('codneg es requerido');
    }

    try {
      let where = 'WHERE r.codneg_res = @codneg';
      const params: any = { codneg };

      if (desde && !Number.isNaN(desde.getTime())) {
        where += ' AND r.fecini_res >= @desde';
        params.desde = desde;
      }
      if (hasta && !Number.isNaN(hasta.getTime())) {
        where += ' AND r.fecfin_res <= @hasta';
        params.hasta = hasta;
      }

      const query = `
        SELECT
          r.codres_res  AS codres,
          r.codneg_res  AS codneg,
          r.codcli_res  AS codcli,
          r.fecini_res  AS fecini,
          r.fecfin_res  AS fecfin,
          r.fechcrea    AS fecres,
          r.estado_res  AS estado,
          r.detalle_res AS detalle,
          CONCAT(
            ISNULL(p.nombre_per, ''),
            CASE WHEN p.apellidos_per IS NULL OR LTRIM(RTRIM(p.apellidos_per)) = ''
                 THEN '' ELSE CONCAT(' ', p.apellidos_per) END
          ) AS cliente_nombre
        FROM dbo.reservas r
        LEFT JOIN dbo.clientes c ON c.codcli_cli = r.codcli_res
        LEFT JOIN dbo.personas p ON p.codper_per = c.codper_cli
        ${where}
        ORDER BY r.fecini_res DESC;`;
      return await this.sql.executeQueryParams(query, params);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async obtener(codres: number, codneg?: number) {
    if (!codres) {
      throw new BadRequestException('codres es requerido');
    }

    try {
      const whereCodneg = codneg ? 'AND codneg_res = @codneg' : '';
      const rows = await this.sql.executeQueryParams(
        `SELECT * FROM reservas WHERE codres_res = @codres ${whereCodneg};`,
        { codres, codneg: codneg ?? null },
      );

      const reserva = rows?.[0];
      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      return reserva;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(this.formatError(error));
    }
  }
}
