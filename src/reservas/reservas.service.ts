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

  async listar(codneg: number, desde?: Date | null, hasta?: Date | null) {
    if (!codneg) {
      throw new BadRequestException('codneg es requerido');
    }

    try {
      let where = 'WHERE codneg_res = @codneg';
      const params: any = { codneg };

      if (desde && !Number.isNaN(desde.getTime())) {
        where += ' AND fecini_res >= @desde';
        params.desde = desde;
      }
      if (hasta && !Number.isNaN(hasta.getTime())) {
        where += ' AND fecfin_res <= @hasta';
        params.hasta = hasta;
      }

      const query = `SELECT * FROM reservas ${where} ORDER BY fecini_res DESC;`;
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
