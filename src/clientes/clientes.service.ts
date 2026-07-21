import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

@Injectable()
export class ClientesService {
  constructor(private readonly sql: SqlService) {}

  async listar(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    try {
      const query = `
        SELECT c.codcli_cli AS codcli, c.codper_cli AS codper, c.estado_cli AS estado,
               c.fiar_cli AS fiar, c.limite_fiado_cli AS limite_fiado,
               p.nombre_per AS nombre, p.apellidos_per AS apellidos,
               p.email_per AS email, p.telper_per AS telefono,
               p.cedula_per AS cedula
        FROM dbo.clientes c
        INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
        WHERE c.codneg_cli = @codneg AND c.estado_cli = 'A'
        ORDER BY p.nombre_per, p.apellidos_per;
      `;
      return await this.sql.executeQueryParams(query, { codneg });
    } catch (error: any) {
      throw new BadRequestException(error?.message ?? 'Error al listar clientes');
    }
  }

  /** Lista completa incluyendo inactivos (para la pantalla de gestión). */
  async listarTodos(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    const query = `
      SELECT c.codcli_cli AS codcli, c.codper_cli AS codper, c.estado_cli AS estado,
             c.fiar_cli AS fiar, c.limite_fiado_cli AS limite_fiado,
             p.nombre_per AS nombre, p.apellidos_per AS apellidos,
             p.email_per AS email, p.telper_per AS telefono,
             p.cedula_per AS cedula,
             (SELECT ISNULL(SUM(f.saldo_fia), 0) FROM dbo.fiaos f
               WHERE f.codcli_fia = c.codcli_cli AND f.codneg_fia = @codneg
                 AND f.estado_fia IN ('pendiente','parcial')) AS deuda_fiao
      FROM dbo.clientes c
      INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
      WHERE c.codneg_cli = @codneg
      ORDER BY c.estado_cli, p.nombre_per, p.apellidos_per;
    `;
    return await this.sql.executeQueryParams(query, { codneg });
  }

  /** Cambia el estado del cliente (activar/inactivar). */
  async setEstado(dto: { codcli: number; codneg: number; estado: 'A' | 'I'; usermod?: number | null }) {
    const codcli = Number(dto.codcli);
    if (!Number.isFinite(codcli) || codcli <= 0) {
      throw new BadRequestException('codcli es requerido');
    }
    const rows = await this.sql.executeQueryParams(
      `UPDATE dbo.clientes
         SET estado_cli = @estado, usermod = @usermod, fechmod = GETDATE()
       OUTPUT INSERTED.codcli_cli AS codcli, INSERTED.estado_cli AS estado
       WHERE codcli_cli = @codcli AND codneg_cli = @codneg;`,
      {
        codcli,
        codneg: dto.codneg,
        estado: dto.estado === 'I' ? 'I' : 'A',
        usermod: dto.usermod ?? null,
      },
    );
    return rows?.[0] ?? null;
  }

  /** Configura el fiao del cliente: si se le puede fiar y su límite de deuda. */
  async setFiado(dto: {
    codcli: number; codneg: number;
    fiar: boolean; limiteFiado?: number | null;
    usermod?: number | null;
  }) {
    const codcli = Number(dto.codcli);
    if (!Number.isFinite(codcli) || codcli <= 0) {
      throw new BadRequestException('codcli es requerido');
    }
    let limite: number | null = null;
    if (dto.limiteFiado !== undefined && dto.limiteFiado !== null && dto.limiteFiado !== ('' as any)) {
      limite = Number(dto.limiteFiado);
      if (!Number.isFinite(limite) || limite < 0) {
        throw new BadRequestException('Límite de fiado inválido');
      }
    }
    const rows = await this.sql.executeQueryParams(
      `UPDATE dbo.clientes
         SET fiar_cli = @fiar, limite_fiado_cli = @limite, usermod = @usermod, fechmod = GETDATE()
       OUTPUT INSERTED.codcli_cli AS codcli, INSERTED.fiar_cli AS fiar, INSERTED.limite_fiado_cli AS limite_fiado
       WHERE codcli_cli = @codcli AND codneg_cli = @codneg;`,
      {
        codcli,
        codneg: dto.codneg,
        fiar: dto.fiar ? 1 : 0,
        limite,
        usermod: dto.usermod ?? null,
      },
    );
    if (!rows?.length) throw new BadRequestException('Cliente no existe en este negocio');
    return rows[0];
  }

  async crear(dto: { codneg: number; codper: number; usercrea?: number | null }) {
    try {
      const query = `
        INSERT INTO dbo.clientes (codper_cli, codneg_cli, estado_cli, usercrea)
        OUTPUT INSERTED.codcli_cli AS codcli
        VALUES (@codper, @codneg, 'A', @usercrea);
      `;
      return await this.sql.executeQueryParams(query, {
        codper: dto.codper,
        codneg: dto.codneg,
        usercrea: dto.usercrea ?? null,
      });
    } catch (error: any) {
      throw new BadRequestException(error?.message ?? 'Error al crear cliente');
    }
  }

  async buscar(codneg: number, q: string) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    try {
      const query = `
        SELECT TOP 20 c.codcli_cli AS codcli, c.codper_cli AS codper,
               p.nombre_per AS nombre, p.apellidos_per AS apellidos,
               p.email_per AS email, p.telper_per AS telefono,
               p.cedula_per AS cedula
        FROM dbo.clientes c
        INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
        WHERE c.codneg_cli = @codneg AND c.estado_cli = 'A'
          AND (p.nombre_per LIKE '%' + @q + '%'
               OR p.apellidos_per LIKE '%' + @q + '%'
               OR p.email_per LIKE '%' + @q + '%')
        ORDER BY p.nombre_per, p.apellidos_per;
      `;
      return await this.sql.executeQueryParams(query, { codneg, q: q || '' });
    } catch (error: any) {
      throw new BadRequestException(error?.message ?? 'Error al buscar clientes');
    }
  }
}
