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
