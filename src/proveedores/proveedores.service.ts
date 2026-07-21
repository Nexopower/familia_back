import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

/**
 * Proveedores: pueden estar vinculados a una persona O ser una "empresa"
 * con datos propios (nombre_pro / telefono_pro / nota_pro).
 */
@Injectable()
export class ProveedoresService {
  constructor(private readonly sql: SqlService) {}

  async listar(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    try {
      const query = `
        SELECT pr.codpro_pro AS codpro, pr.codper_pro AS codper, pr.estado_pro AS estado,
               COALESCE(pr.nombre_pro, p.nombre_per) AS nombre,
               CASE WHEN pr.codper_pro IS NULL THEN NULL ELSE p.apellidos_per END AS apellidos,
               p.email_per AS email,
               COALESCE(pr.telefono_pro, p.telper_per) AS telefono,
               p.cedula_per AS cedula,
               pr.nota_pro AS nota,
               CAST(CASE WHEN pr.codper_pro IS NULL THEN 0 ELSE 1 END AS bit) AS tiene_persona
        FROM dbo.proveedores pr
        LEFT JOIN dbo.personas p ON p.codper_per = pr.codper_pro
        WHERE pr.codneg_pro = @codneg AND pr.estado_pro = 'A'
        ORDER BY COALESCE(pr.nombre_pro, p.nombre_per), p.apellidos_per;
      `;
      return await this.sql.executeQueryParams(query, { codneg });
    } catch (error: any) {
      throw new BadRequestException(
        error?.message ?? 'Error al listar proveedores',
      );
    }
  }

  /** Lista completa incluyendo inactivos (para la pantalla de gestión). */
  async listarTodos(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    const query = `
      SELECT pr.codpro_pro AS codpro, pr.codper_pro AS codper, pr.estado_pro AS estado,
             COALESCE(pr.nombre_pro, p.nombre_per) AS nombre,
             CASE WHEN pr.codper_pro IS NULL THEN NULL ELSE p.apellidos_per END AS apellidos,
             p.email_per AS email,
             COALESCE(pr.telefono_pro, p.telper_per) AS telefono,
             p.cedula_per AS cedula,
             pr.nota_pro AS nota,
             CAST(CASE WHEN pr.codper_pro IS NULL THEN 0 ELSE 1 END AS bit) AS tiene_persona
      FROM dbo.proveedores pr
      LEFT JOIN dbo.personas p ON p.codper_per = pr.codper_pro
      WHERE pr.codneg_pro = @codneg
      ORDER BY pr.estado_pro, COALESCE(pr.nombre_pro, p.nombre_per);
    `;
    return await this.sql.executeQueryParams(query, { codneg });
  }

  async crear(dto: {
    codneg: number;
    codper?: number | null;
    nombre?: string | null;
    telefono?: string | null;
    nota?: string | null;
    usercrea?: number | null;
  }) {
    const codper = dto.codper == null ? null : Number(dto.codper);
    const nombre = dto.nombre?.trim() || null;
    // Regla: persona vinculada O nombre propio (empresa), al menos uno.
    if (!codper && !nombre) {
      throw new BadRequestException(
        'El proveedor requiere una persona vinculada o un nombre (empresa).',
      );
    }
    try {
      const query = `
        INSERT INTO dbo.proveedores (codper_pro, codneg_pro, nombre_pro, telefono_pro, nota_pro, estado_pro, usercrea)
        OUTPUT INSERTED.codpro_pro AS codpro
        VALUES (@codper, @codneg, @nombre, @telefono, @nota, 'A', @usercrea);
      `;
      return await this.sql.executeQueryParams(query, {
        codper,
        codneg: dto.codneg,
        nombre,
        telefono: dto.telefono?.trim() || null,
        nota: dto.nota?.trim() || null,
        usercrea: dto.usercrea ?? null,
      });
    } catch (error: any) {
      throw new BadRequestException(
        error?.message ?? 'Error al crear proveedor',
      );
    }
  }

  async actualizar(dto: {
    codpro: number;
    codneg: number;
    codper?: number | null;
    nombre?: string | null;
    telefono?: string | null;
    nota?: string | null;
    estado?: 'A' | 'I';
    usermod?: number | null;
  }) {
    const codpro = Number(dto.codpro);
    if (!Number.isFinite(codpro) || codpro <= 0) {
      throw new BadRequestException('codpro es requerido');
    }

    const set: string[] = [];
    const params: Record<string, any> = {
      codpro,
      codneg: dto.codneg,
      usermod: dto.usermod ?? null,
    };

    if (dto.codper !== undefined) { set.push('codper_pro = @codper'); params.codper = dto.codper == null ? null : Number(dto.codper); }
    if (dto.nombre !== undefined) { set.push('nombre_pro = @nombre'); params.nombre = dto.nombre?.trim() || null; }
    if (dto.telefono !== undefined) { set.push('telefono_pro = @telefono'); params.telefono = dto.telefono?.trim() || null; }
    if (dto.nota !== undefined) { set.push('nota_pro = @nota'); params.nota = dto.nota?.trim() || null; }
    if (dto.estado !== undefined) { set.push('estado_pro = @estado'); params.estado = dto.estado === 'I' ? 'I' : 'A'; }

    if (!set.length) throw new BadRequestException('No hay campos para actualizar');

    try {
      const rows = await this.sql.executeQueryParams(
        `UPDATE dbo.proveedores
           SET ${set.join(', ')}, usermod = @usermod, fechmod = GETDATE()
         OUTPUT INSERTED.codpro_pro AS codpro, INSERTED.estado_pro AS estado
         WHERE codpro_pro = @codpro AND codneg_pro = @codneg;`,
        params,
      );
      return rows?.[0] ?? null;
    } catch (error: any) {
      throw new BadRequestException(
        error?.message ?? 'Error al actualizar proveedor',
      );
    }
  }

  async buscar(codneg: number, q: string) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    try {
      const query = `
        SELECT TOP 20 pr.codpro_pro AS codpro, pr.codper_pro AS codper,
               COALESCE(pr.nombre_pro, p.nombre_per) AS nombre,
               CASE WHEN pr.codper_pro IS NULL THEN NULL ELSE p.apellidos_per END AS apellidos,
               p.email_per AS email,
               COALESCE(pr.telefono_pro, p.telper_per) AS telefono,
               p.cedula_per AS cedula
        FROM dbo.proveedores pr
        LEFT JOIN dbo.personas p ON p.codper_per = pr.codper_pro
        WHERE pr.codneg_pro = @codneg AND pr.estado_pro = 'A'
          AND (COALESCE(pr.nombre_pro, p.nombre_per) LIKE '%' + @q + '%'
               OR p.apellidos_per LIKE '%' + @q + '%'
               OR p.email_per LIKE '%' + @q + '%'
               OR p.cedula_per LIKE '%' + @q + '%')
        ORDER BY COALESCE(pr.nombre_pro, p.nombre_per), p.apellidos_per;
      `;
      return await this.sql.executeQueryParams(query, { codneg, q: q || '' });
    } catch (error: any) {
      throw new BadRequestException(
        error?.message ?? 'Error al buscar proveedores',
      );
    }
  }
}
