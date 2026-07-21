import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

/** CRUD del catálogo de direcciones (usado por negocios). */
@Injectable()
export class DireccionesService {
  constructor(private readonly sql: SqlService) {}

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación.'
    );
  }

  async listar(limit = 300) {
    const top = Math.min(Math.max(Number(limit) || 300, 1), 1000);
    return await this.sql.executeQueryParams(
      `
      SELECT TOP (@top)
        d.coddir_dir     AS coddir,
        d.direccion_dir  AS direccion,
        d.sector_dir     AS sector,
        d.ciudad_dir     AS ciudad,
        d.referencia_dir AS referencia,
        d.estado_dir     AS estado
      FROM dbo.direcciones d
      WHERE d.estado_dir = 'A'
      ORDER BY d.direccion_dir;
      `,
      { top },
    );
  }

  async buscar(q: string) {
    const term = String(q ?? '').trim();
    if (term.length < 2) {
      throw new BadRequestException('q debe tener al menos 2 caracteres');
    }
    return await this.sql.executeQueryParams(
      `
      SELECT TOP 20
        d.coddir_dir     AS coddir,
        d.direccion_dir  AS direccion,
        d.sector_dir     AS sector,
        d.ciudad_dir     AS ciudad,
        d.referencia_dir AS referencia
      FROM dbo.direcciones d
      WHERE d.estado_dir = 'A'
        AND (
          d.direccion_dir LIKE @q
          OR ISNULL(d.sector_dir, '') LIKE @q
          OR ISNULL(d.ciudad_dir, '') LIKE @q
          OR ISNULL(d.referencia_dir, '') LIKE @q
        )
      ORDER BY d.direccion_dir;
      `,
      { q: `%${term}%` },
    );
  }

  async crear(dto: {
    direccion: string;
    sector?: string | null;
    ciudad?: string | null;
    referencia?: string | null;
    usercrea?: number | null;
  }) {
    const direccion = String(dto.direccion ?? '').trim();
    if (!direccion) throw new BadRequestException('direccion es requerida');

    try {
      const rows = await this.sql.executeQueryParams(
        `
        INSERT INTO dbo.direcciones (direccion_dir, sector_dir, ciudad_dir, referencia_dir, usercrea)
        OUTPUT
          INSERTED.coddir_dir     AS coddir,
          INSERTED.direccion_dir  AS direccion,
          INSERTED.sector_dir     AS sector,
          INSERTED.ciudad_dir     AS ciudad,
          INSERTED.referencia_dir AS referencia
        VALUES (@direccion, @sector, @ciudad, @referencia, @usercrea);
        `,
        {
          direccion,
          sector: dto.sector?.trim() || null,
          ciudad: dto.ciudad?.trim() || null,
          referencia: dto.referencia?.trim() || null,
          usercrea: dto.usercrea ?? null,
        },
      );
      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async actualizar(dto: {
    coddir: number;
    direccion?: string;
    sector?: string | null;
    ciudad?: string | null;
    referencia?: string | null;
    estado?: 'A' | 'I';
    usermod?: number | null;
  }) {
    const coddir = Number(dto.coddir);
    if (!Number.isFinite(coddir) || coddir <= 0) {
      throw new BadRequestException('coddir es requerido');
    }

    const set: string[] = [];
    const params: Record<string, any> = { coddir, usermod: dto.usermod ?? null };

    if (dto.direccion !== undefined) {
      const direccion = String(dto.direccion ?? '').trim();
      if (!direccion) throw new BadRequestException('direccion no puede ser vacía');
      set.push('direccion_dir = @direccion');
      params.direccion = direccion;
    }
    if (dto.sector !== undefined) { set.push('sector_dir = @sector'); params.sector = dto.sector?.trim() || null; }
    if (dto.ciudad !== undefined) { set.push('ciudad_dir = @ciudad'); params.ciudad = dto.ciudad?.trim() || null; }
    if (dto.referencia !== undefined) { set.push('referencia_dir = @referencia'); params.referencia = dto.referencia?.trim() || null; }
    if (dto.estado !== undefined) { set.push('estado_dir = @estado'); params.estado = dto.estado === 'I' ? 'I' : 'A'; }

    if (!set.length) throw new BadRequestException('No hay campos para actualizar');

    try {
      const rows = await this.sql.executeQueryParams(
        `
        UPDATE dbo.direcciones
          SET ${set.join(', ')}, usermod = @usermod, fechmod = GETDATE()
        OUTPUT
          INSERTED.coddir_dir     AS coddir,
          INSERTED.direccion_dir  AS direccion,
          INSERTED.sector_dir     AS sector,
          INSERTED.ciudad_dir     AS ciudad,
          INSERTED.referencia_dir AS referencia,
          INSERTED.estado_dir     AS estado
        WHERE coddir_dir = @coddir;
        `,
        params,
      );
      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }
}
