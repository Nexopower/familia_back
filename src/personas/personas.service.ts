import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

@Injectable()
export class PersonasService {
  constructor(private readonly sql: SqlService) {}

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación.'
    );
  }

  async buscar(q: string) {
    if (!q || !q.trim()) {
      throw new BadRequestException('Parámetro de búsqueda (q) es requerido');
    }

    const searchTerm = `%${q.trim()}%`;

    try {
      const rows = await this.sql.executeQueryParams(
        `
        SELECT TOP 20
          p.codper_per AS codper,
          p.nombre_per AS nombre,
          p.apellidos_per AS apellidos,
          p.email_per AS email,
          p.telper_per AS telefono,
          p.direccion_per AS direccion,
          p.codsex_per AS sexo,
          p.fecnac_per AS fecnac
        FROM dbo.personas p
        WHERE p.nombre_per LIKE @q
           OR p.apellidos_per LIKE @q
           OR p.email_per LIKE @q
           OR p.telper_per LIKE @q
        ORDER BY p.nombre_per, p.apellidos_per;
        `,
        { q: searchTerm },
      );

      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  /** Lista completa de personas (gestión). */
  async listar(limit = 300) {
    const top = Math.min(Math.max(Number(limit) || 300, 1), 1000);
    return await this.sql.executeQueryParams(
      `
      SELECT TOP (@top)
        p.codper_per    AS codper,
        p.nombre_per    AS nombre,
        p.apellidos_per AS apellidos,
        p.cedula_per    AS cedula,
        p.email_per     AS email,
        p.telper_per    AS telefono,
        p.direccion_per AS direccion,
        p.codsex_per    AS codsex,
        p.fecnac_per    AS fecnac
      FROM dbo.personas p
      ORDER BY p.nombre_per, p.apellidos_per;
      `,
      { top },
    );
  }

  /** Actualiza los datos de una persona (solo los campos enviados). */
  async actualizar(dto: {
    codper: number;
    nombre?: string;
    apellido?: string;
    email?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    cedula?: string | null;
    codsex?: string | null;
    fecnac?: string | null;
    usermod?: number | null;
  }) {
    const codper = Number(dto.codper);
    if (!Number.isFinite(codper) || codper <= 0) {
      throw new BadRequestException('codper es requerido');
    }

    const set: string[] = [];
    const params: Record<string, any> = { codper, usermod: dto.usermod ?? null };

    if (dto.nombre !== undefined) {
      const nombre = String(dto.nombre ?? '').trim();
      if (!nombre) throw new BadRequestException('nombre no puede ser vacío');
      set.push('nombre_per = @nombre');
      params.nombre = nombre;
    }
    if (dto.apellido !== undefined) {
      set.push('apellidos_per = @apellido');
      params.apellido = String(dto.apellido ?? '').trim() || null;
    }
    if (dto.email !== undefined) { set.push('email_per = @email'); params.email = dto.email?.trim() || null; }
    if (dto.telefono !== undefined) { set.push('telper_per = @telefono'); params.telefono = dto.telefono?.trim() || null; }
    if (dto.direccion !== undefined) { set.push('direccion_per = @direccion'); params.direccion = dto.direccion?.trim() || null; }
    if (dto.cedula !== undefined) { set.push('cedula_per = @cedula'); params.cedula = dto.cedula?.trim() || null; }
    if (dto.codsex !== undefined) { set.push('codsex_per = @codsex'); params.codsex = dto.codsex?.trim() || null; }
    if (dto.fecnac !== undefined) { set.push('fecnac_per = @fecnac'); params.fecnac = dto.fecnac || null; }

    if (!set.length) throw new BadRequestException('No hay campos para actualizar');

    try {
      const rows = await this.sql.executeQueryParams(
        `
        UPDATE dbo.personas
          SET ${set.join(', ')}, usermod = @usermod, fechmod = GETDATE()
        OUTPUT
          INSERTED.codper_per    AS codper,
          INSERTED.nombre_per    AS nombre,
          INSERTED.apellidos_per AS apellidos,
          INSERTED.cedula_per    AS cedula,
          INSERTED.email_per     AS email,
          INSERTED.telper_per    AS telefono,
          INSERTED.direccion_per AS direccion
        WHERE codper_per = @codper;
        `,
        params,
      );
      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async crear(dto: {
    nombre: string;
    apellido?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    codsex?: string;
    fecnac?: string;
    usercrea?: number;
  }) {
    const nombre = String(dto?.nombre ?? '').trim();
    if (!nombre) throw new BadRequestException('nombre es requerido');

    try {
      const rows = await this.sql.executeQueryParams(
        `
        INSERT INTO dbo.personas (
          nombre_per, apellidos_per, email_per, telper_per,
          direccion_per, codsex_per, fecnac_per, usercrea, fechcrea
        )
        OUTPUT
          INSERTED.codper_per     AS codper,
          INSERTED.nombre_per     AS nombre,
          INSERTED.apellidos_per  AS apellidos,
          INSERTED.email_per      AS email,
          INSERTED.telper_per     AS telefono,
          INSERTED.direccion_per  AS direccion
        VALUES (
          @nombre, @apellido, @email, @telefono,
          @direccion, @sexo, @fecnac, @usercrea, GETDATE()
        );
        `,
        {
          nombre,
          apellido: dto.apellido?.trim() || null,
          email: dto.email?.trim() || null,
          telefono: dto.telefono?.trim() || null,
          direccion: dto.direccion?.trim() || null,
          sexo: dto.codsex?.trim() || null,
          fecnac: dto.fecnac || null,
          usercrea: dto.usercrea ?? null,
        },
      );

      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }
}
