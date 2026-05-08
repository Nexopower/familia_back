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
               p.nombre_per AS nombre, p.apellido_per AS apellido,
               p.email_per AS email, p.telefono_per AS telefono
        FROM dbo.clientes c
        INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
        WHERE c.codneg_cli = @codneg AND c.estado_cli = 'A'
        ORDER BY p.nombre_per, p.apellido_per;
      `;
      return await this.sql.executeQueryParams(query, { codneg });
    } catch (error: any) {
      throw new BadRequestException(error?.message ?? 'Error al listar clientes');
    }
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
               p.nombre_per AS nombre, p.apellido_per AS apellido,
               p.email_per AS email, p.telefono_per AS telefono
        FROM dbo.clientes c
        INNER JOIN dbo.personas p ON p.codper_per = c.codper_cli
        WHERE c.codneg_cli = @codneg AND c.estado_cli = 'A'
          AND (p.nombre_per LIKE '%' + @q + '%'
               OR p.apellido_per LIKE '%' + @q + '%'
               OR p.email_per LIKE '%' + @q + '%')
        ORDER BY p.nombre_per, p.apellido_per;
      `;
      return await this.sql.executeQueryParams(query, { codneg, q: q || '' });
    } catch (error: any) {
      throw new BadRequestException(error?.message ?? 'Error al buscar clientes');
    }
  }
}
