import { Injectable, BadRequestException } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

@Injectable()
export class ProductosService {
  constructor(private readonly sql: SqlService) {}

  async listar(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    const query = `
      SELECT
        codprd_prd AS codprd,
        codneg_prd AS codneg,
        nombre_prd AS nombre,
        codigo_prd AS codigo,
        codcat_prd AS codcat,
        codmar_prd AS codmar,
        stockmin_prd AS stockmin,
        estado_prd AS estado,
        fechcrea,
        fechmod
      FROM dbo.producto
      WHERE codneg_prd = @codneg;
    `;
    return await this.sql.executeQueryParams(query, { codneg });
  }

  async crear(dto: {
    codneg: number;
    nombre: string;
    codigo?: string;
    codcat?: number;
    codmar?: number;
    stockmin?: number | null;
    usercrea?: number;
  }) {
    if (!dto.codneg || !dto.nombre)
      throw new BadRequestException('codneg y nombre son requeridos');
    const query = `
            INSERT INTO producto (nombre_prd, codigo_prd, codcat_prd, codmar_prd, stockmin_prd, codneg_prd, usercrea)
            OUTPUT
              inserted.codprd_prd AS codprd,
              inserted.codneg_prd AS codneg,
              inserted.nombre_prd AS nombre,
              inserted.codigo_prd AS codigo,
              inserted.codcat_prd AS codcat,
              inserted.codmar_prd AS codmar,
              inserted.stockmin_prd AS stockmin,
              inserted.estado_prd AS estado,
              inserted.fechcrea,
              inserted.fechmod
            VALUES (@nombre, @codigo, @codcat, @codmar, @stockmin, @codneg, @usercrea)
        `;

    const rows = await this.sql.executeQueryParams(query, {
      nombre: dto.nombre,
      codigo: dto.codigo ?? null,
      codcat: dto.codcat ?? null,
      codmar: dto.codmar ?? null,
      stockmin: dto.stockmin === undefined ? null : dto.stockmin,
      codneg: dto.codneg,
      usercrea: dto.usercrea ?? null,
    });
    return rows?.[0];
  }

  async actualizar(dto: {
    codneg: number;
    codprd: number;
    nombre?: string;
    codigo?: string | null;
    codcat?: number | null;
    codmar?: number | null;
    stockmin?: number | null;
    estado?: 'A' | 'I';
    usermod?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codprd = Number(dto.codprd);

    if (!Number.isFinite(codneg) || !codneg) {
      throw new BadRequestException('codneg es requerido');
    }
    if (!Number.isFinite(codprd) || !codprd) {
      throw new BadRequestException('codprd es requerido');
    }

    const set: string[] = [];
    const params: Record<string, any> = {
      codneg,
      codprd,
      usermod: dto.usermod ?? null,
    };

    if (dto.nombre !== undefined) {
      const nombre = String(dto.nombre ?? '').trim();
      if (!nombre) throw new BadRequestException('nombre no puede ser vacío');
      set.push('nombre_prd = @nombre');
      params.nombre = nombre;
    }

    if (dto.codigo !== undefined) {
      const codigoRaw = dto.codigo;
      const codigo = codigoRaw === null ? null : String(codigoRaw).trim();
      set.push('codigo_prd = @codigo');
      params.codigo = codigo ? codigo : null;
    }

    if (dto.codcat !== undefined) {
      const codcat = dto.codcat === null ? null : Number(dto.codcat);
      if (codcat !== null && (!Number.isFinite(codcat) || codcat <= 0)) {
        throw new BadRequestException('codcat inválido');
      }
      set.push('codcat_prd = @codcat');
      params.codcat = codcat;
    }

    if (dto.codmar !== undefined) {
      const codmar = dto.codmar === null ? null : Number(dto.codmar);
      if (codmar !== null && (!Number.isFinite(codmar) || codmar <= 0)) {
        throw new BadRequestException('codmar inválido');
      }
      set.push('codmar_prd = @codmar');
      params.codmar = codmar;
    }

    if (dto.stockmin !== undefined) {
      const stockmin = dto.stockmin === null ? null : Number(dto.stockmin);
      if (stockmin !== null) {
        if (!Number.isFinite(stockmin) || stockmin < 0) {
          throw new BadRequestException('stockmin inválido');
        }
        if (!Number.isInteger(stockmin)) {
          throw new BadRequestException('stockmin debe ser entero');
        }
      }
      set.push('stockmin_prd = @stockmin');
      params.stockmin = stockmin;
    }

    if (dto.estado !== undefined) {
      const estado = dto.estado === 'I' ? 'I' : 'A';
      set.push('estado_prd = @estado');
      params.estado = estado;
    }

    if (!set.length) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    const query = `
      UPDATE dbo.producto
        SET ${set.join(', ')},
            usermod = @usermod,
            fechmod = GETDATE()
      OUTPUT
        inserted.codprd_prd AS codprd,
        inserted.codneg_prd AS codneg,
        inserted.nombre_prd AS nombre,
        inserted.codigo_prd AS codigo,
        inserted.codcat_prd AS codcat,
        inserted.codmar_prd AS codmar,
        inserted.stockmin_prd AS stockmin,
        inserted.estado_prd AS estado,
        inserted.fechcrea,
        inserted.fechmod
      WHERE codprd_prd = @codprd AND codneg_prd = @codneg;
    `;

    const rows = await this.sql.executeQueryParams(query, params);
    return rows?.[0] ?? null;
  }

  async inactivar(dto: { codneg: number; codprd: number; usermod?: number }) {
    const codneg = Number(dto.codneg);
    const codprd = Number(dto.codprd);

    if (!Number.isFinite(codneg) || !codneg) {
      throw new BadRequestException('codneg es requerido');
    }
    if (!Number.isFinite(codprd) || !codprd) {
      throw new BadRequestException('codprd es requerido');
    }

    const rows = await this.sql.executeQueryParams(
      `
        UPDATE dbo.producto
          SET estado_prd = 'I',
              usermod = @usermod,
              fechmod = GETDATE()
        OUTPUT
          inserted.codprd_prd AS codprd,
          inserted.codneg_prd AS codneg,
          inserted.nombre_prd AS nombre,
          inserted.codigo_prd AS codigo,
          inserted.codcat_prd AS codcat,
          inserted.codmar_prd AS codmar,
          inserted.estado_prd AS estado,
          inserted.fechcrea,
          inserted.fechmod
        WHERE codprd_prd = @codprd AND codneg_prd = @codneg;
      `,
      { codneg, codprd, usermod: dto.usermod ?? null },
    );

    return rows?.[0] ?? null;
  }

  async listarCategorias(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    return await this.sql.executeQueryParams(
      `
        SELECT
          codcat_cat AS codcat,
          nombre_cat AS nombre,
          codneg_cat AS codneg,
          estado_cat AS estado,
          fechcrea,
          fechmod
        FROM dbo.categorias
        WHERE (codneg_cat = @codneg OR codneg_cat IS NULL)
          AND estado_cat = 'A'
        ORDER BY nombre_cat;
      `,
      { codneg },
    );
  }

  async crearCategoria(dto: { codneg: number; nombre: string; usercrea?: number }) {
    const codneg = Number(dto.codneg);
    const nombre = String(dto.nombre ?? '').trim();
    if (!Number.isFinite(codneg) || !codneg) throw new BadRequestException('codneg es requerido');
    if (!nombre) throw new BadRequestException('nombre es requerido');

    const rows = await this.sql.executeQueryParams(
      `
        INSERT INTO dbo.categorias (nombre_cat, codneg_cat, usercrea)
        OUTPUT
          inserted.codcat_cat AS codcat,
          inserted.nombre_cat AS nombre,
          inserted.codneg_cat AS codneg,
          inserted.estado_cat AS estado,
          inserted.fechcrea,
          inserted.fechmod
        VALUES (@nombre, @codneg, @usercrea);
      `,
      { nombre, codneg, usercrea: dto.usercrea ?? null },
    );
    return rows?.[0] ?? null;
  }

  async actualizarCategoria(dto: {
    codneg: number;
    codcat: number;
    nombre?: string;
    estado?: 'A' | 'I';
    usermod?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codcat = Number(dto.codcat);
    if (!Number.isFinite(codneg) || !codneg) throw new BadRequestException('codneg es requerido');
    if (!Number.isFinite(codcat) || !codcat) throw new BadRequestException('codcat es requerido');

    const set: string[] = [];
    const params: Record<string, any> = { codneg, codcat, usermod: dto.usermod ?? null };

    if (dto.nombre !== undefined) {
      const nombre = String(dto.nombre ?? '').trim();
      if (!nombre) throw new BadRequestException('nombre no puede ser vacío');
      set.push('nombre_cat = @nombre');
      params.nombre = nombre;
    }
    if (dto.estado !== undefined) {
      const estado = dto.estado === 'I' ? 'I' : 'A';
      set.push('estado_cat = @estado');
      params.estado = estado;
    }

    if (!set.length) throw new BadRequestException('No hay campos para actualizar');

    const rows = await this.sql.executeQueryParams(
      `
        UPDATE dbo.categorias
          SET ${set.join(', ')},
              usermod = @usermod,
              fechmod = GETDATE()
        OUTPUT
          inserted.codcat_cat AS codcat,
          inserted.nombre_cat AS nombre,
          inserted.codneg_cat AS codneg,
          inserted.estado_cat AS estado,
          inserted.fechcrea,
          inserted.fechmod
        WHERE codcat_cat = @codcat AND (codneg_cat = @codneg OR codneg_cat IS NULL);
      `,
      params,
    );

    return rows?.[0] ?? null;
  }

  async inactivarCategoria(dto: { codneg: number; codcat: number; usermod?: number }) {
    const codneg = Number(dto.codneg);
    const codcat = Number(dto.codcat);
    if (!Number.isFinite(codneg) || !codneg) throw new BadRequestException('codneg es requerido');
    if (!Number.isFinite(codcat) || !codcat) throw new BadRequestException('codcat es requerido');

    const rows = await this.sql.executeQueryParams(
      `
        UPDATE dbo.categorias
          SET estado_cat = 'I',
              usermod = @usermod,
              fechmod = GETDATE()
        OUTPUT
          inserted.codcat_cat AS codcat,
          inserted.nombre_cat AS nombre,
          inserted.codneg_cat AS codneg,
          inserted.estado_cat AS estado,
          inserted.fechcrea,
          inserted.fechmod
        WHERE codcat_cat = @codcat AND (codneg_cat = @codneg OR codneg_cat IS NULL);
      `,
      { codneg, codcat, usermod: dto.usermod ?? null },
    );

    return rows?.[0] ?? null;
  }

  async listarMarcas(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    return await this.sql.executeQueryParams(
      `
        SELECT
          codmar_mar AS codmar,
          nombre_mar AS nombre,
          codneg_mar AS codneg,
          estado_mar AS estado,
          fechcrea,
          fechmod
        FROM dbo.marcas
        WHERE (codneg_mar = @codneg OR codneg_mar IS NULL)
          AND estado_mar = 'A'
        ORDER BY nombre_mar;
      `,
      { codneg },
    );
  }

  async crearMarca(dto: { codneg: number; nombre: string; usercrea?: number }) {
    const codneg = Number(dto.codneg);
    const nombre = String(dto.nombre ?? '').trim();
    if (!Number.isFinite(codneg) || !codneg) throw new BadRequestException('codneg es requerido');
    if (!nombre) throw new BadRequestException('nombre es requerido');

    const rows = await this.sql.executeQueryParams(
      `
        INSERT INTO dbo.marcas (nombre_mar, codneg_mar, usercrea)
        OUTPUT
          inserted.codmar_mar AS codmar,
          inserted.nombre_mar AS nombre,
          inserted.codneg_mar AS codneg,
          inserted.estado_mar AS estado,
          inserted.fechcrea,
          inserted.fechmod
        VALUES (@nombre, @codneg, @usercrea);
      `,
      { nombre, codneg, usercrea: dto.usercrea ?? null },
    );
    return rows?.[0] ?? null;
  }

  async actualizarMarca(dto: {
    codneg: number;
    codmar: number;
    nombre?: string;
    estado?: 'A' | 'I';
    usermod?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codmar = Number(dto.codmar);
    if (!Number.isFinite(codneg) || !codneg) throw new BadRequestException('codneg es requerido');
    if (!Number.isFinite(codmar) || !codmar) throw new BadRequestException('codmar es requerido');

    const set: string[] = [];
    const params: Record<string, any> = { codneg, codmar, usermod: dto.usermod ?? null };

    if (dto.nombre !== undefined) {
      const nombre = String(dto.nombre ?? '').trim();
      if (!nombre) throw new BadRequestException('nombre no puede ser vacío');
      set.push('nombre_mar = @nombre');
      params.nombre = nombre;
    }
    if (dto.estado !== undefined) {
      const estado = dto.estado === 'I' ? 'I' : 'A';
      set.push('estado_mar = @estado');
      params.estado = estado;
    }

    if (!set.length) throw new BadRequestException('No hay campos para actualizar');

    const rows = await this.sql.executeQueryParams(
      `
        UPDATE dbo.marcas
          SET ${set.join(', ')},
              usermod = @usermod,
              fechmod = GETDATE()
        OUTPUT
          inserted.codmar_mar AS codmar,
          inserted.nombre_mar AS nombre,
          inserted.codneg_mar AS codneg,
          inserted.estado_mar AS estado,
          inserted.fechcrea,
          inserted.fechmod
        WHERE codmar_mar = @codmar AND (codneg_mar = @codneg OR codneg_mar IS NULL);
      `,
      params,
    );

    return rows?.[0] ?? null;
  }

  async inactivarMarca(dto: { codneg: number; codmar: number; usermod?: number }) {
    const codneg = Number(dto.codneg);
    const codmar = Number(dto.codmar);
    if (!Number.isFinite(codneg) || !codneg) throw new BadRequestException('codneg es requerido');
    if (!Number.isFinite(codmar) || !codmar) throw new BadRequestException('codmar es requerido');

    const rows = await this.sql.executeQueryParams(
      `
        UPDATE dbo.marcas
          SET estado_mar = 'I',
              usermod = @usermod,
              fechmod = GETDATE()
        OUTPUT
          inserted.codmar_mar AS codmar,
          inserted.nombre_mar AS nombre,
          inserted.codneg_mar AS codneg,
          inserted.estado_mar AS estado,
          inserted.fechcrea,
          inserted.fechmod
        WHERE codmar_mar = @codmar AND (codneg_mar = @codneg OR codneg_mar IS NULL);
      `,
      { codneg, codmar, usermod: dto.usermod ?? null },
    );

    return rows?.[0] ?? null;
  }
}
