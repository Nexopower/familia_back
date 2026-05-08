import { Injectable, BadRequestException } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

/**
 * Servicio de Inventario Avanzado
 * Maneja: Unidades de medida, Conversiones, Composición/Recetas (BOM), Transformaciones
 */
@Injectable()
export class InventarioAvanzadoService {
  constructor(private readonly sql: SqlService) {}

  // ═══════════════════════════════════════════════════════════════════
  // UNIDADES DE MEDIDA (catálogo global)
  // ═══════════════════════════════════════════════════════════════════

  async listarUnidadesMedida(filtros?: { tipo?: string; estado?: string }) {
    const tipo = filtros?.tipo?.trim() || null;
    const estado = filtros?.estado === 'I' ? 'I' : 'A';

    const query = `
      SELECT
        codumd_umd AS codumd,
        nombre_umd AS nombre,
        simbolo_umd AS simbolo,
        tipo_umd AS tipo,
        estado_umd AS estado,
        fechcrea, fechmod
      FROM dbo.unidades_medida
      WHERE estado_umd = @estado
        AND (@tipo IS NULL OR tipo_umd = @tipo)
      ORDER BY tipo_umd, nombre_umd;
    `;
    return await this.sql.executeQueryParams(query, { estado, tipo });
  }

  async crearUnidadMedida(dto: {
    nombre: string;
    simbolo?: string;
    tipo: string;
    usercrea?: number;
  }) {
    const nombre = String(dto.nombre ?? '').trim();
    const simbolo = dto.simbolo?.trim() || null;
    const tipo = String(dto.tipo ?? '').trim();

    if (!nombre) throw new BadRequestException('nombre es requerido');
    if (!tipo) throw new BadRequestException('tipo es requerido (ej: volumen, conteo, peso)');

    const query = `
      INSERT INTO dbo.unidades_medida (nombre_umd, simbolo_umd, tipo_umd, usercrea)
      OUTPUT
        inserted.codumd_umd AS codumd,
        inserted.nombre_umd AS nombre,
        inserted.simbolo_umd AS simbolo,
        inserted.tipo_umd AS tipo,
        inserted.estado_umd AS estado,
        inserted.fechcrea, inserted.fechmod
      VALUES (@nombre, @simbolo, @tipo, @usercrea);
    `;

    const rows = await this.sql.executeQueryParams(query, {
      nombre,
      simbolo,
      tipo,
      usercrea: dto.usercrea ?? null,
    });
    return rows?.[0] ?? null;
  }

  async actualizarUnidadMedida(dto: {
    codumd: number;
    nombre?: string;
    simbolo?: string;
    tipo?: string;
    estado?: 'A' | 'I';
    usermod?: number;
  }) {
    const codumd = Number(dto.codumd);
    if (!Number.isFinite(codumd) || codumd <= 0) {
      throw new BadRequestException('codumd es requerido');
    }

    const set: string[] = [];
    const params: Record<string, any> = { codumd, usermod: dto.usermod ?? null };

    if (dto.nombre !== undefined) {
      const nombre = String(dto.nombre ?? '').trim();
      if (!nombre) throw new BadRequestException('nombre no puede ser vacío');
      set.push('nombre_umd = @nombre');
      params.nombre = nombre;
    }
    if (dto.simbolo !== undefined) {
      set.push('simbolo_umd = @simbolo');
      params.simbolo = dto.simbolo?.trim() || null;
    }
    if (dto.tipo !== undefined) {
      const tipo = String(dto.tipo ?? '').trim();
      if (!tipo) throw new BadRequestException('tipo no puede ser vacío');
      set.push('tipo_umd = @tipo');
      params.tipo = tipo;
    }
    if (dto.estado !== undefined) {
      set.push('estado_umd = @estado');
      params.estado = dto.estado === 'I' ? 'I' : 'A';
    }

    if (!set.length) throw new BadRequestException('No hay campos para actualizar');

    const query = `
      UPDATE dbo.unidades_medida
        SET ${set.join(', ')}, usermod = @usermod, fechmod = GETDATE()
      OUTPUT
        inserted.codumd_umd AS codumd,
        inserted.nombre_umd AS nombre,
        inserted.simbolo_umd AS simbolo,
        inserted.tipo_umd AS tipo,
        inserted.estado_umd AS estado,
        inserted.fechcrea, inserted.fechmod
      WHERE codumd_umd = @codumd;
    `;

    const rows = await this.sql.executeQueryParams(query, params);
    return rows?.[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONVERSIONES DE UNIDADES (por negocio)
  // Regla: cantidad_origen * factor = cantidad_destino
  // ═══════════════════════════════════════════════════════════════════

  async listarConversiones(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');

    const query = `
      SELECT
        c.codcnv_cnv AS codcnv,
        c.codneg_cnv AS codneg,
        c.codumd_origen_cnv AS codumd_origen,
        uo.nombre_umd AS nombre_origen,
        uo.simbolo_umd AS simbolo_origen,
        c.codumd_destino_cnv AS codumd_destino,
        ud.nombre_umd AS nombre_destino,
        ud.simbolo_umd AS simbolo_destino,
        c.factor_cnv AS factor,
        c.estado_cnv AS estado,
        c.fechcrea, c.fechmod
      FROM dbo.conversion_um c
      INNER JOIN dbo.unidades_medida uo ON uo.codumd_umd = c.codumd_origen_cnv
      INNER JOIN dbo.unidades_medida ud ON ud.codumd_umd = c.codumd_destino_cnv
      WHERE c.codneg_cnv = @codneg
        AND c.estado_cnv = 'A'
      ORDER BY uo.nombre_umd, ud.nombre_umd;
    `;
    return await this.sql.executeQueryParams(query, { codneg });
  }

  async crearConversion(dto: {
    codneg: number;
    codumd_origen: number;
    codumd_destino: number;
    factor: number;
    usercrea?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codumd_origen = Number(dto.codumd_origen);
    const codumd_destino = Number(dto.codumd_destino);
    const factor = Number(dto.factor);

    if (!codneg) throw new BadRequestException('codneg es requerido');
    if (!codumd_origen) throw new BadRequestException('codumd_origen es requerido');
    if (!codumd_destino) throw new BadRequestException('codumd_destino es requerido');
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new BadRequestException('factor debe ser un número positivo');
    }
    if (codumd_origen === codumd_destino) {
      throw new BadRequestException('Las unidades origen y destino deben ser diferentes');
    }

    const query = `
      INSERT INTO dbo.conversion_um (codneg_cnv, codumd_origen_cnv, codumd_destino_cnv, factor_cnv, usercrea)
      OUTPUT
        inserted.codcnv_cnv AS codcnv,
        inserted.codneg_cnv AS codneg,
        inserted.codumd_origen_cnv AS codumd_origen,
        inserted.codumd_destino_cnv AS codumd_destino,
        inserted.factor_cnv AS factor,
        inserted.estado_cnv AS estado,
        inserted.fechcrea, inserted.fechmod
      VALUES (@codneg, @codumd_origen, @codumd_destino, @factor, @usercrea);
    `;

    const rows = await this.sql.executeQueryParams(query, {
      codneg,
      codumd_origen,
      codumd_destino,
      factor,
      usercrea: dto.usercrea ?? null,
    });
    return rows?.[0] ?? null;
  }

  async actualizarConversion(dto: {
    codcnv: number;
    codneg: number;
    factor?: number;
    estado?: 'A' | 'I';
    usermod?: number;
  }) {
    const codcnv = Number(dto.codcnv);
    const codneg = Number(dto.codneg);

    if (!codcnv) throw new BadRequestException('codcnv es requerido');
    if (!codneg) throw new BadRequestException('codneg es requerido');

    const set: string[] = [];
    const params: Record<string, any> = { codcnv, codneg, usermod: dto.usermod ?? null };

    if (dto.factor !== undefined) {
      const factor = Number(dto.factor);
      if (!Number.isFinite(factor) || factor <= 0) {
        throw new BadRequestException('factor debe ser un número positivo');
      }
      set.push('factor_cnv = @factor');
      params.factor = factor;
    }
    if (dto.estado !== undefined) {
      set.push('estado_cnv = @estado');
      params.estado = dto.estado === 'I' ? 'I' : 'A';
    }

    if (!set.length) throw new BadRequestException('No hay campos para actualizar');

    const query = `
      UPDATE dbo.conversion_um
        SET ${set.join(', ')}, usermod = @usermod, fechmod = GETDATE()
      OUTPUT
        inserted.codcnv_cnv AS codcnv,
        inserted.codneg_cnv AS codneg,
        inserted.codumd_origen_cnv AS codumd_origen,
        inserted.codumd_destino_cnv AS codumd_destino,
        inserted.factor_cnv AS factor,
        inserted.estado_cnv AS estado,
        inserted.fechcrea, inserted.fechmod
      WHERE codcnv_cnv = @codcnv AND codneg_cnv = @codneg;
    `;

    const rows = await this.sql.executeQueryParams(query, params);
    return rows?.[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRODUCTO - UNIDAD DE MEDIDA (unidad base por producto por negocio)
  // ═══════════════════════════════════════════════════════════════════

  async obtenerProductoUM(codneg: number, codprd: number) {
    if (!codneg || !codprd) throw new BadRequestException('codneg y codprd son requeridos');

    const query = `
      SELECT
        pu.codpum_pum AS codpum,
        pu.codneg_pum AS codneg,
        pu.codprd_pum AS codprd,
        pu.codumd_pum AS codumd,
        um.nombre_umd AS nombre_unidad,
        um.simbolo_umd AS simbolo_unidad,
        pu.factor_inventario_pum AS factor_inventario,
        pu.fechcrea, pu.fechmod
      FROM dbo.producto_um pu
      INNER JOIN dbo.unidades_medida um ON um.codumd_umd = pu.codumd_pum
      WHERE pu.codneg_pum = @codneg AND pu.codprd_pum = @codprd;
    `;
    const rows = await this.sql.executeQueryParams(query, { codneg, codprd });
    return rows?.[0] ?? null;
  }

  async setProductoUM(dto: {
    codneg: number;
    codprd: number;
    codumd: number;
    factor_inventario?: number;
    usercrea?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codprd = Number(dto.codprd);
    const codumd = Number(dto.codumd);
    const factor = dto.factor_inventario != null ? Number(dto.factor_inventario) : 1;

    if (!codneg) throw new BadRequestException('codneg es requerido');
    if (!codprd) throw new BadRequestException('codprd es requerido');
    if (!codumd) throw new BadRequestException('codumd es requerido');

    // UPSERT: si existe actualiza, si no inserta
    const query = `
      MERGE dbo.producto_um AS t
      USING (SELECT @codneg AS codneg, @codprd AS codprd) AS s
        ON t.codneg_pum = s.codneg AND t.codprd_pum = s.codprd
      WHEN MATCHED THEN
        UPDATE SET codumd_pum = @codumd, factor_inventario_pum = @factor,
                   usermod = @usercrea, fechmod = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (codneg_pum, codprd_pum, codumd_pum, factor_inventario_pum, usercrea)
        VALUES (@codneg, @codprd, @codumd, @factor, @usercrea);

      SELECT
        pu.codpum_pum AS codpum,
        pu.codneg_pum AS codneg,
        pu.codprd_pum AS codprd,
        pu.codumd_pum AS codumd,
        um.nombre_umd AS nombre_unidad,
        um.simbolo_umd AS simbolo_unidad,
        pu.factor_inventario_pum AS factor_inventario
      FROM dbo.producto_um pu
      INNER JOIN dbo.unidades_medida um ON um.codumd_umd = pu.codumd_pum
      WHERE pu.codneg_pum = @codneg AND pu.codprd_pum = @codprd;
    `;

    const rows = await this.sql.executeQueryParams(query, {
      codneg,
      codprd,
      codumd,
      factor,
      usercrea: dto.usercrea ?? null,
    });
    return rows?.[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMPOSICIÓN / RECETAS (BOM) - Producto final → insumos
  // ═══════════════════════════════════════════════════════════════════

  async listarComposicion(codneg: number, codprd_final: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    if (!codprd_final) throw new BadRequestException('codprd_final es requerido');

    const query = `
      SELECT
        pc.codpco_pco AS codpco,
        pc.codneg_pco AS codneg,
        pc.codprd_final_pco AS codprd_final,
        pc.codprd_insumo_pco AS codprd_insumo,
        pi.nombre_prd AS nombre_insumo,
        pi.codigo_prd AS codigo_insumo,
        pc.cantidad_insumo_pco AS cantidad,
        pc.estado_pco AS estado,
        pc.fechcrea, pc.fechmod
      FROM dbo.producto_composicion pc
      INNER JOIN dbo.producto pi ON pi.codprd_prd = pc.codprd_insumo_pco
      WHERE pc.codneg_pco = @codneg
        AND pc.codprd_final_pco = @codprd_final
        AND pc.estado_pco = 'A'
      ORDER BY pi.nombre_prd;
    `;
    return await this.sql.executeQueryParams(query, { codneg, codprd_final });
  }

  async listarProductosConReceta(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');

    const query = `
      SELECT DISTINCT
        p.codprd_prd AS codprd,
        p.nombre_prd AS nombre,
        p.codigo_prd AS codigo,
        (SELECT COUNT(*) FROM dbo.producto_composicion pc
         WHERE pc.codneg_pco = @codneg AND pc.codprd_final_pco = p.codprd_prd AND pc.estado_pco = 'A') AS num_insumos
      FROM dbo.producto p
      INNER JOIN dbo.producto_composicion pc
        ON pc.codprd_final_pco = p.codprd_prd AND pc.codneg_pco = @codneg AND pc.estado_pco = 'A'
      WHERE p.codneg_prd = @codneg AND p.estado_prd = 'A'
      ORDER BY p.nombre_prd;
    `;
    return await this.sql.executeQueryParams(query, { codneg });
  }

  async setComposicion(dto: {
    codneg: number;
    codprd_final: number;
    insumos: Array<{ codprd_insumo: number; cantidad: number }>;
    usercrea?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codprd_final = Number(dto.codprd_final);

    if (!codneg) throw new BadRequestException('codneg es requerido');
    if (!codprd_final) throw new BadRequestException('codprd_final es requerido');

    // Validar que el producto existe y pertenece al negocio
    const prod = await this.sql.executeQueryParams(
      `SELECT codprd_prd FROM dbo.producto WHERE codprd_prd = @codprd_final AND codneg_prd = @codneg`,
      { codneg, codprd_final },
    );
    if (!prod?.length) {
      throw new BadRequestException('El producto final no existe en este negocio');
    }

    // Usar el SP de la BD que hace el trabajo
    const insumosJson = JSON.stringify(
      (dto.insumos || []).map((i) => ({
        codprd_insumo: Number(i.codprd_insumo),
        cantidad: Number(i.cantidad),
      })),
    );

    await this.sql.executeQueryParams(
      `EXEC dbo.sp_producto_composicion_set @codneg, @codprd_final, @insumos_json, @usercrea`,
      {
        codneg,
        codprd_final,
        insumos_json: insumosJson,
        usercrea: dto.usercrea ?? null,
      },
    );

    // Retornar la composición actualizada
    return await this.listarComposicion(codneg, codprd_final);
  }

  async eliminarItemComposicion(dto: {
    codneg: number;
    codpco: number;
    usermod?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codpco = Number(dto.codpco);

    if (!codneg) throw new BadRequestException('codneg es requerido');
    if (!codpco) throw new BadRequestException('codpco es requerido');

    const query = `
      UPDATE dbo.producto_composicion
        SET estado_pco = 'I', usermod = @usermod, fechmod = GETDATE()
      OUTPUT
        inserted.codpco_pco AS codpco,
        inserted.estado_pco AS estado
      WHERE codpco_pco = @codpco AND codneg_pco = @codneg;
    `;

    const rows = await this.sql.executeQueryParams(query, {
      codneg,
      codpco,
      usermod: dto.usermod ?? null,
    });
    return rows?.[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // TRANSFORMACIONES (producción interna: caja→paquetes, granel→botellas)
  // ═══════════════════════════════════════════════════════════════════

  async listarTransformaciones(dto: {
    codneg: number;
    desde?: Date;
    hasta?: Date;
    limit?: number;
  }) {
    if (!dto.codneg) throw new BadRequestException('codneg es requerido');

    const limit = Math.min(Math.max(Number(dto.limit ?? 50), 1), 200);

    const query = `
      SELECT TOP (@limit)
        t.codtrf_trf AS codtrf,
        t.codneg_trf AS codneg,
        t.fecha_trf AS fecha,
        t.tipo_trf AS tipo,
        t.estado_trf AS estado,
        t.codusr_trf AS codusr,
        t.detalle_trf AS detalle,
        t.fechcrea, t.fechmod,
        (SELECT COUNT(*) FROM dbo.transformaciones_det td WHERE td.codtrf_tfd = t.codtrf_trf) AS num_items
      FROM dbo.transformaciones t
      WHERE t.codneg_trf = @codneg
        AND (@desde IS NULL OR t.fecha_trf >= @desde)
        AND (@hasta IS NULL OR t.fecha_trf < DATEADD(DAY, 1, @hasta))
      ORDER BY t.fecha_trf DESC;
    `;

    return await this.sql.executeQueryParams(query, {
      codneg: Number(dto.codneg),
      desde: dto.desde ?? null,
      hasta: dto.hasta ?? null,
      limit,
    });
  }

  async obtenerTransformacion(codneg: number, codtrf: number) {
    if (!codneg || !codtrf) throw new BadRequestException('codneg y codtrf son requeridos');

    const headerQuery = `
      SELECT
        t.codtrf_trf AS codtrf,
        t.codneg_trf AS codneg,
        t.fecha_trf AS fecha,
        t.tipo_trf AS tipo,
        t.estado_trf AS estado,
        t.codusr_trf AS codusr,
        t.detalle_trf AS detalle,
        t.fechcrea, t.fechmod
      FROM dbo.transformaciones t
      WHERE t.codtrf_trf = @codtrf AND t.codneg_trf = @codneg;
    `;

    const detQuery = `
      SELECT
        td.codtfd_tfd AS codtfd,
        td.codtrf_tfd AS codtrf,
        td.codprd_tfd AS codprd,
        p.nombre_prd AS nombre_producto,
        p.codigo_prd AS codigo_producto,
        td.tipo_tfd AS tipo,
        td.cantidad_tfd AS cantidad,
        td.detalle_tfd AS detalle
      FROM dbo.transformaciones_det td
      INNER JOIN dbo.producto p ON p.codprd_prd = td.codprd_tfd
      WHERE td.codtrf_tfd = @codtrf
      ORDER BY td.tipo_tfd DESC, p.nombre_prd;
    `;

    const [headers, detalles] = await Promise.all([
      this.sql.executeQueryParams(headerQuery, { codtrf, codneg }),
      this.sql.executeQueryParams(detQuery, { codtrf }),
    ]);

    if (!headers?.length) return null;

    return {
      ...headers[0],
      items: detalles || [],
    };
  }

  async crearTransformacion(dto: {
    codneg: number;
    detalle?: string;
    tipo?: string;
    items: Array<{
      codprd: number;
      tipo: 'entrada' | 'salida';
      cantidad: number;
      detalle?: string;
    }>;
    codusr?: string;
    usercrea?: number;
  }) {
    const codneg = Number(dto.codneg);
    if (!codneg) throw new BadRequestException('codneg es requerido');

    if (!dto.items?.length) {
      throw new BadRequestException('Se requiere al menos un item (entrada o salida)');
    }

    // Validar que hay al menos una salida y una entrada (típico para transformación)
    const salidas = dto.items.filter((i) => i.tipo === 'salida');
    const entradas = dto.items.filter((i) => i.tipo === 'entrada');

    if (!salidas.length && !entradas.length) {
      throw new BadRequestException('Se requiere al menos una entrada o salida');
    }

    // Preparar JSON para el SP
    const payload = {
      detalle: dto.detalle || null,
      tipo: dto.tipo || 'manual',
      items: dto.items.map((i) => ({
        codprd: Number(i.codprd),
        tipo: i.tipo,
        cantidad: Number(i.cantidad),
        detalle: i.detalle || null,
      })),
    };

    const query = `
      DECLARE @codtrf_out INT;
      EXEC dbo.sp_transformacion_registrar
        @codneg = @codneg,
        @payload_json = @payload,
        @codusr = @codusr,
        @usercrea = @usercrea,
        @codtrf_out = @codtrf_out OUTPUT;
      SELECT @codtrf_out AS codtrf;
    `;

    const rows = await this.sql.executeQueryParams(query, {
      codneg,
      payload: JSON.stringify(payload),
      codusr: dto.codusr ?? null,
      usercrea: dto.usercrea ?? null,
    });

    const codtrf = rows?.[0]?.codtrf;
    if (!codtrf) return null;

    // Retornar la transformación completa
    return await this.obtenerTransformacion(codneg, codtrf);
  }

  // ═══════════════════════════════════════════════════════════════════
  // DETALLE PRODUCTO (precio) - producto_det
  // ═══════════════════════════════════════════════════════════════════

  async obtenerProductoDetalle(codneg: number, codprd: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');
    if (!codprd) throw new BadRequestException('codprd es requerido');

    const query = `
      SELECT
        pd.codpdt_pdt AS codpdt,
        pd.codprd_pdt AS codprd,
        pd.precio_pdt AS precio_venta,
        pd.precio_compra_pdt AS precio_compra,
        ISNULL(pd.precio_compra_pdt, est.costo_estimado) AS costo_unitario_referencia,
        est.costo_estimado AS costo_unitario_estimado,
        pd.fechcrea, pd.fechmod
      FROM dbo.producto p
      LEFT JOIN dbo.producto_det pd ON pd.codprd_pdt = p.codprd_prd
      OUTER APPLY (
        SELECT TOP (1)
          CAST(pd_pack.precio_compra_pdt / NULLIF(pc.cantidad_insumo_pco, 0) AS decimal(18,6)) AS costo_estimado
        FROM dbo.producto_composicion pc
        INNER JOIN dbo.producto_det pd_pack ON pd_pack.codprd_pdt = pc.codprd_final_pco
        WHERE pc.codneg_pco = @codneg
          AND pc.codprd_insumo_pco = p.codprd_prd
          AND pc.estado_pco = 'A'
          AND pc.cantidad_insumo_pco > 0
          AND pd_pack.precio_compra_pdt IS NOT NULL
          AND pd_pack.precio_compra_pdt > 0
        ORDER BY pd_pack.precio_compra_pdt / pc.cantidad_insumo_pco ASC
      ) est
      WHERE p.codprd_prd = @codprd
        AND p.codneg_prd = @codneg;
    `;
    const rows = await this.sql.executeQueryParams(query, { codneg, codprd });
    return rows?.[0] ?? null;
  }

  async setProductoDetalle(dto: {
    codneg: number;
    codprd: number;
    precio_venta?: number | null;
    precio_compra?: number | null;
    usercrea?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codprd = Number(dto.codprd);
    const hasPrecioVenta = dto.precio_venta !== undefined;
    const hasPrecioCompra = dto.precio_compra !== undefined;

    if (!codneg) throw new BadRequestException('codneg es requerido');
    if (!codprd) throw new BadRequestException('codprd es requerido');
    if (!hasPrecioVenta && !hasPrecioCompra) {
      throw new BadRequestException('Debe enviar precio_venta o precio_compra');
    }

    const precioVenta =
      hasPrecioVenta && dto.precio_venta !== null ? Number(dto.precio_venta) : null;
    const precioCompra =
      hasPrecioCompra && dto.precio_compra !== null ? Number(dto.precio_compra) : null;

    if (hasPrecioVenta && precioVenta !== null && (!Number.isFinite(precioVenta) || precioVenta < 0)) {
      throw new BadRequestException('precio_venta debe ser un número >= 0');
    }
    if (
      hasPrecioCompra &&
      precioCompra !== null &&
      (!Number.isFinite(precioCompra) || precioCompra < 0)
    ) {
      throw new BadRequestException('precio_compra debe ser un número >= 0');
    }

    // UPSERT
    const query = `
      MERGE dbo.producto_det AS t
      USING (SELECT @codprd AS codprd) AS s
        ON t.codprd_pdt = s.codprd
      WHEN MATCHED THEN
        UPDATE SET
          precio_pdt = CASE WHEN @hasPrecioVenta = 1 THEN @precioVenta ELSE t.precio_pdt END,
          precio_compra_pdt = CASE WHEN @hasPrecioCompra = 1 THEN @precioCompra ELSE t.precio_compra_pdt END,
          usermod = @usercrea,
          fechmod = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (codprd_pdt, precio_pdt, precio_compra_pdt, usercrea)
        VALUES (@codprd, ISNULL(@precioVenta, 0), @precioCompra, @usercrea);

      SELECT
        pd.codpdt_pdt AS codpdt,
        pd.codprd_pdt AS codprd,
        pd.precio_pdt AS precio_venta,
        pd.precio_compra_pdt AS precio_compra,
        ISNULL(pd.precio_compra_pdt, est.costo_estimado) AS costo_unitario_referencia,
        est.costo_estimado AS costo_unitario_estimado,
        pd.fechcrea, pd.fechmod
      FROM dbo.producto p
      LEFT JOIN dbo.producto_det pd ON pd.codprd_pdt = p.codprd_prd
      OUTER APPLY (
        SELECT TOP (1)
          CAST(pd_pack.precio_compra_pdt / NULLIF(pc.cantidad_insumo_pco, 0) AS decimal(18,6)) AS costo_estimado
        FROM dbo.producto_composicion pc
        INNER JOIN dbo.producto_det pd_pack ON pd_pack.codprd_pdt = pc.codprd_final_pco
        WHERE pc.codneg_pco = @codneg
          AND pc.codprd_insumo_pco = p.codprd_prd
          AND pc.estado_pco = 'A'
          AND pc.cantidad_insumo_pco > 0
          AND pd_pack.precio_compra_pdt IS NOT NULL
          AND pd_pack.precio_compra_pdt > 0
        ORDER BY pd_pack.precio_compra_pdt / pc.cantidad_insumo_pco ASC
      ) est
      WHERE p.codprd_prd = @codprd
        AND p.codneg_prd = @codneg;
    `;

    const rows = await this.sql.executeQueryParams(query, {
      codneg,
      codprd,
      hasPrecioVenta: hasPrecioVenta ? 1 : 0,
      hasPrecioCompra: hasPrecioCompra ? 1 : 0,
      precioVenta,
      precioCompra,
      usercrea: dto.usercrea ?? null,
    });
    return rows?.[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // VENTA DE PRODUCTO (aplica receta si existe, o descuenta directo)
  // ═══════════════════════════════════════════════════════════════════

  async ventaProducto(dto: {
    codneg: number;
    codprd: number;
    cantidad: number;
    codusr?: string;
    usercrea?: number;
  }) {
    const codneg = Number(dto.codneg);
    const codprd = Number(dto.codprd);
    const cantidad = Number(dto.cantidad);

    if (!codneg) throw new BadRequestException('codneg es requerido');
    if (!codprd) throw new BadRequestException('codprd es requerido');
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new BadRequestException('cantidad debe ser un entero positivo');
    }

    const query = `
      EXEC dbo.sp_venta_producto
        @codneg = @codneg,
        @codprd_final = @codprd,
        @cantidad = @cantidad,
        @codusr = @codusr,
        @usercrea = @usercrea;
    `;

    await this.sql.executeQueryParams(query, {
      codneg,
      codprd,
      cantidad,
      codusr: dto.codusr ?? null,
      usercrea: dto.usercrea ?? null,
    });

    return { ok: true, message: 'Venta procesada correctamente' };
  }

  // ═══════════════════════════════════════════════════════════════════
  // VISTA CONSOLIDADA: Producto con stock, precio y unidad
  // ═══════════════════════════════════════════════════════════════════

  async listarProductosConDetalles(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');

    const query = `
      SELECT
        p.codprd_prd AS codprd,
        p.nombre_prd AS nombre,
        p.codigo_prd AS codigo,
        p.codcat_prd AS codcat,
        c.nombre_cat AS categoria,
        p.codmar_prd AS codmar,
        m.nombre_mar AS marca,
        p.stockmin_prd AS stockmin,
        p.estado_prd AS estado,
        ISNULL(i.stock_inv, 0) AS stock,
        ISNULL(pd.precio_pdt, 0) AS precio,
        pd.precio_pdt AS precio_venta,
        pd.precio_compra_pdt AS precio_compra,
        ISNULL(pd.precio_compra_pdt, est.costo_estimado) AS costo_unitario_referencia,
        est.costo_estimado AS costo_unitario_estimado,
        pu.codumd_pum AS codumd,
        um.nombre_umd AS unidad,
        um.simbolo_umd AS simbolo_unidad,
        CASE WHEN EXISTS (
          SELECT 1 FROM dbo.producto_composicion pc
          WHERE pc.codneg_pco = @codneg AND pc.codprd_final_pco = p.codprd_prd AND pc.estado_pco = 'A'
        ) THEN 1 ELSE 0 END AS tiene_receta,
        p.fechcrea, p.fechmod
      FROM dbo.producto p
      LEFT JOIN dbo.categorias c ON c.codcat_cat = p.codcat_prd
      LEFT JOIN dbo.marcas m ON m.codmar_mar = p.codmar_prd
      LEFT JOIN dbo.inventario i ON i.codneg_inv = p.codneg_prd AND i.codprd_inv = p.codprd_prd
      LEFT JOIN dbo.producto_det pd ON pd.codprd_pdt = p.codprd_prd
      OUTER APPLY (
        SELECT TOP (1)
          CAST(pd_pack.precio_compra_pdt / NULLIF(pc.cantidad_insumo_pco, 0) AS decimal(18,6)) AS costo_estimado
        FROM dbo.producto_composicion pc
        INNER JOIN dbo.producto_det pd_pack ON pd_pack.codprd_pdt = pc.codprd_final_pco
        WHERE pc.codneg_pco = @codneg
          AND pc.codprd_insumo_pco = p.codprd_prd
          AND pc.estado_pco = 'A'
          AND pc.cantidad_insumo_pco > 0
          AND pd_pack.precio_compra_pdt IS NOT NULL
          AND pd_pack.precio_compra_pdt > 0
        ORDER BY pd_pack.precio_compra_pdt / pc.cantidad_insumo_pco ASC
      ) est
      LEFT JOIN dbo.producto_um pu ON pu.codneg_pum = p.codneg_prd AND pu.codprd_pum = p.codprd_prd
      LEFT JOIN dbo.unidades_medida um ON um.codumd_umd = pu.codumd_pum
      WHERE p.codneg_prd = @codneg AND p.estado_prd = 'A'
      ORDER BY p.nombre_prd;
    `;

    return await this.sql.executeQueryParams(query, { codneg });
  }
}
