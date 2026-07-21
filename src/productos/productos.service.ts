import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { SqlService } from 'src/sql/sql.service';

/** TTL de catálogos casi estáticos (categorías/marcas). */
const CATALOGO_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ProductosService {
  constructor(
    private readonly sql: SqlService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private catKey(tipo: 'categorias' | 'marcas', codneg: number) {
    return `cat:${tipo}:${codneg}`;
  }

  async listar(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    const query = `
      SELECT
        p.codprd_prd AS codprd,
        p.codneg_prd AS codneg,
        p.nombre_prd AS nombre,
        p.codigo_prd AS codigo,
        p.codcat_prd AS codcat,
        p.codmar_prd AS codmar,
        p.stockmin_prd AS stockmin,
        p.tipo_prd AS tipo_prd,
        pd.precio_pdt AS precio,
        pd.precio_compra_pdt AS precio_compra,
        p.estado_prd AS estado,
        (SELECT COUNT(*) FROM dbo.producto_composicion pc
         WHERE pc.codneg_pco = p.codneg_prd AND pc.codprd_final_pco = p.codprd_prd AND pc.estado_pco = 'A') AS num_insumos,
        p.fechcrea,
        p.fechmod,
        CASE WHEN EXISTS (
          SELECT 1 FROM dbo.producto_empaque pe2
          WHERE pe2.codneg_pem = p.codneg_prd AND pe2.codprd_contenido_pem = p.codprd_prd
        ) THEN 1 ELSE 0 END AS es_contenido_empaque,
        pu.codumd_pum AS codumd,
        um.nombre_umd AS nombre_umd,
        um.simbolo_umd AS simbolo_umd,
        um.tipo_umd AS tipo_umd,
        (
          SELECT TOP 1 pd_emp.precio_compra_pdt / pe_p.cantidad_pem
          FROM dbo.producto_empaque pe_p
          INNER JOIN dbo.producto_det pd_emp ON pd_emp.codprd_pdt = pe_p.codprd_pem
          WHERE pe_p.codneg_pem = p.codneg_prd
            AND pe_p.codprd_contenido_pem = p.codprd_prd
            AND pe_p.estado_pem = 'A'
            AND pd_emp.precio_compra_pdt > 0
            AND pe_p.cantidad_pem > 0
          ORDER BY pd_emp.precio_compra_pdt / pe_p.cantidad_pem ASC
        ) AS costo_por_empaque
      FROM dbo.producto p
      OUTER APPLY (
        SELECT TOP 1 precio_pdt, precio_compra_pdt
        FROM dbo.producto_det pd
        WHERE pd.codprd_pdt = p.codprd_prd
        ORDER BY pd.codpdt_pdt DESC
      ) pd
      LEFT JOIN dbo.producto_um pu ON pu.codneg_pum = p.codneg_prd AND pu.codprd_pum = p.codprd_prd
      LEFT JOIN dbo.unidades_medida um ON um.codumd_umd = pu.codumd_pum
      WHERE p.codneg_prd = @codneg;
    `;
    return await this.sql.executeQueryParams(query, { codneg });
  }

  async buscar(codneg: number, q: string) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    const qParam = `%${String(q ?? '').trim()}%`;
    const query = `
      SELECT TOP 20
        p.codprd_prd AS codprd,
        p.codneg_prd AS codneg,
        p.nombre_prd AS nombre,
        p.codigo_prd AS codigo,
        p.codcat_prd AS codcat,
        p.codmar_prd AS codmar,
        p.tipo_prd AS tipo_prd,
        pd.precio_pdt AS precio,
        pd.precio_compra_pdt AS precio_compra,
        CASE WHEN EXISTS (
          SELECT 1 FROM dbo.producto_empaque pe2
          WHERE pe2.codneg_pem = p.codneg_prd AND pe2.codprd_contenido_pem = p.codprd_prd
        ) THEN 1 ELSE 0 END AS es_contenido_empaque,
        pu.codumd_pum AS codumd,
        um.nombre_umd AS nombre_umd,
        um.simbolo_umd AS simbolo_umd,
        um.tipo_umd AS tipo_umd,
        (
          SELECT TOP 1 pd_emp.precio_compra_pdt / pe_p.cantidad_pem
          FROM dbo.producto_empaque pe_p
          INNER JOIN dbo.producto_det pd_emp ON pd_emp.codprd_pdt = pe_p.codprd_pem
          WHERE pe_p.codneg_pem = p.codneg_prd
            AND pe_p.codprd_contenido_pem = p.codprd_prd
            AND pe_p.estado_pem = 'A'
            AND pd_emp.precio_compra_pdt > 0
            AND pe_p.cantidad_pem > 0
          ORDER BY pd_emp.precio_compra_pdt / pe_p.cantidad_pem ASC
        ) AS costo_por_empaque
      FROM dbo.producto p
      OUTER APPLY (
        SELECT TOP 1 precio_pdt, precio_compra_pdt
        FROM dbo.producto_det pd
        WHERE pd.codprd_pdt = p.codprd_prd
        ORDER BY pd.codpdt_pdt DESC
      ) pd
      LEFT JOIN dbo.producto_um pu ON pu.codneg_pum = p.codneg_prd AND pu.codprd_pum = p.codprd_prd
      LEFT JOIN dbo.unidades_medida um ON um.codumd_umd = pu.codumd_pum
      WHERE p.codneg_prd = @codneg
        AND p.estado_prd = 'A'
        AND (
          p.nombre_prd LIKE @q
          OR p.codigo_prd LIKE @q
          OR CONVERT(VARCHAR(50), p.codcat_prd) LIKE @q
          OR CONVERT(VARCHAR(50), p.codmar_prd) LIKE @q
        )
      ORDER BY p.nombre_prd;
    `;

    return await this.sql.executeQueryParams(query, { codneg, q: qParam });
  }

  async crear(dto: {
    codneg: number;
    nombre: string;
    codigo?: string;
    codcat?: number;
    codmar?: number;
    stockmin?: number | null;
    tipo_prd?: 'simple' | 'compuesto' | 'empaque';
    usercrea?: number;
  }) {
    if (!dto.codneg || !dto.nombre)
      throw new BadRequestException('codneg y nombre son requeridos');
    const tipo_prd = dto.tipo_prd && ['simple', 'compuesto', 'empaque'].includes(dto.tipo_prd)
      ? dto.tipo_prd
      : 'simple';
    const query = `
            INSERT INTO producto (nombre_prd, codigo_prd, codcat_prd, codmar_prd, stockmin_prd, tipo_prd, codneg_prd, usercrea)
            OUTPUT
              inserted.codprd_prd AS codprd,
              inserted.codneg_prd AS codneg,
              inserted.nombre_prd AS nombre,
              inserted.codigo_prd AS codigo,
              inserted.codcat_prd AS codcat,
              inserted.codmar_prd AS codmar,
              inserted.stockmin_prd AS stockmin,
              inserted.tipo_prd AS tipo_prd,
              inserted.estado_prd AS estado,
              inserted.fechcrea,
              inserted.fechmod
            VALUES (@nombre, @codigo, @codcat, @codmar, @stockmin, @tipo_prd, @codneg, @usercrea)
        `;

    const rows = await this.sql.executeQueryParams(query, {
      nombre: dto.nombre,
      codigo: dto.codigo ?? null,
      codcat: dto.codcat ?? null,
      codmar: dto.codmar ?? null,
      stockmin: dto.stockmin === undefined ? null : dto.stockmin,
      tipo_prd,
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
    tipo_prd?: 'simple' | 'compuesto' | 'empaque';
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
        if (stockmin < 0) {
          throw new BadRequestException('stockmin no puede ser negativo');
        }
      }
      set.push('stockmin_prd = @stockmin');
      params.stockmin = stockmin;
    }

    if (dto.tipo_prd !== undefined) {
      const tipo_prd = ['simple', 'compuesto', 'empaque'].includes(dto.tipo_prd) ? dto.tipo_prd : 'simple';
      set.push('tipo_prd = @tipo_prd');
      params.tipo_prd = tipo_prd;
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
        inserted.tipo_prd AS tipo_prd,
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
    const key = this.catKey('categorias', codneg);
    const cacheado = await this.cache.get(key);
    if (cacheado) return cacheado;

    const rows = await this.sql.executeQueryParams(
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
    await this.cache.set(key, rows, CATALOGO_TTL_MS);
    return rows;
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
    await this.cache.del(this.catKey('categorias', codneg));
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

    await this.cache.del(this.catKey('categorias', codneg));
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

    await this.cache.del(this.catKey('categorias', codneg));
    return rows?.[0] ?? null;
  }

  async listarMarcas(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    const key = this.catKey('marcas', codneg);
    const cacheado = await this.cache.get(key);
    if (cacheado) return cacheado;

    const rows = await this.sql.executeQueryParams(
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
    await this.cache.set(key, rows, CATALOGO_TTL_MS);
    return rows;
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
    await this.cache.del(this.catKey('marcas', codneg));
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

    await this.cache.del(this.catKey('marcas', codneg));
    return rows?.[0] ?? null;
  }

  async listarUnidadesMedida() {
    const cacheado = await this.cache.get('cat:unidades');
    if (cacheado) return cacheado;
    const rows = await this.sql.executeQueryParams(
      `SELECT codumd_umd AS codumd, nombre_umd AS nombre, simbolo_umd AS simbolo, tipo_umd AS tipo
       FROM dbo.unidades_medida WHERE estado_umd = 'A' ORDER BY nombre_umd;`,
      {},
    );
    await this.cache.set('cat:unidades', rows, CATALOGO_TTL_MS);
    return rows;
  }

  async setProductoUm(dto: { codneg: number; codprd: number; codumd: number | null; usercrea?: number }) {
    const codneg = Number(dto.codneg);
    const codprd = Number(dto.codprd);
    if (!Number.isFinite(codneg) || !codneg) throw new BadRequestException('codneg es requerido');
    if (!Number.isFinite(codprd) || !codprd) throw new BadRequestException('codprd es requerido');

    if (dto.codumd === null || dto.codumd === undefined) {
      await this.sql.executeQueryParams(
        `DELETE FROM dbo.producto_um WHERE codneg_pum = @codneg AND codprd_pum = @codprd;`,
        { codneg, codprd },
      );
      return { deleted: true };
    }

    const codumd = Number(dto.codumd);
    await this.sql.executeQueryParams(
      `IF EXISTS (SELECT 1 FROM dbo.producto_um WHERE codneg_pum = @codneg AND codprd_pum = @codprd)
         UPDATE dbo.producto_um SET codumd_pum = @codumd, usermod = @usercrea, fechmod = GETDATE()
         WHERE codneg_pum = @codneg AND codprd_pum = @codprd
       ELSE
         INSERT INTO dbo.producto_um (codneg_pum, codprd_pum, codumd_pum, factor_inventario_pum, usercrea)
         VALUES (@codneg, @codprd, @codumd, 1, @usercrea);`,
      { codneg, codprd, codumd, usercrea: dto.usercrea ?? null },
    );
    return { codumd };
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

    await this.cache.del(this.catKey('marcas', codneg));
    return rows?.[0] ?? null;
  }
}
