import { BadRequestException, Injectable } from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

@Injectable()
export class ConfiguracionesService {
  constructor(private readonly sql: SqlService) {}

  private async hasTable(tableName: string): Promise<boolean> {
    const rows = await this.sql.executeQueryParams(
      `SELECT CASE WHEN OBJECT_ID(@tableName, 'U') IS NULL THEN 0 ELSE 1 END AS ok;`,
      { tableName },
    );
    return Number(rows?.[0]?.ok ?? 0) === 1;
  }

  private async hasNegocioColumn(column: string): Promise<boolean> {
    const rows = await this.sql.executeQueryParams(
      `
        SELECT CASE WHEN COL_LENGTH('dbo.negocios', @column) IS NULL THEN 0 ELSE 1 END AS ok;
      `,
      { column },
    );
    return Number(rows?.[0]?.ok ?? 0) === 1;
  }

  private formatError(error: any): string {
    return (
      error?.originalError?.info?.message ||
      error?.message ||
      'Error ejecutando operación.'
    );
  }

  async obtenerStockMinimoDefaultNegocio(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');

    try {
      const hasStockMin = await this.hasNegocioColumn('stockmin_default_neg');
      const rows = await this.sql.executeQueryParams(
        `
        SELECT
          n.codneg_neg AS codneg,
          n.nombre_neg AS nombre,
          ${hasStockMin ? 'n.stockmin_default_neg AS stockmin_default' : 'CAST(NULL AS int) AS stockmin_default'}
        FROM dbo.negocios n
        WHERE n.codneg_neg = @codneg;
        `,
        { codneg },
      );

      return rows?.[0] ?? { codneg, nombre: null, stockmin_default: null };
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async obtenerNegocioConfig(codneg: number) {
    if (!codneg) throw new BadRequestException('codneg es requerido');

    try {
      const hasDireccion = await this.hasNegocioColumn('direccion_neg');
      const hasStockMin = await this.hasNegocioColumn('stockmin_default_neg');
      const rows = await this.sql.executeQueryParams(
        `
        SELECT
          n.codneg_neg AS codneg,
          n.nombre_neg AS nombre,
          n.estado_neg AS estado,
          ${hasDireccion ? 'n.direccion_neg AS direccion,' : 'CAST(NULL AS nvarchar(250)) AS direccion,'}
          ${hasStockMin ? 'n.stockmin_default_neg AS stock_min_default' : 'CAST(NULL AS int) AS stock_min_default'}
        FROM dbo.negocios n
        WHERE n.codneg_neg = @codneg;
        `,
        { codneg },
      );

      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async actualizarNegocioConfig(dto: {
    codneg: number;
    nombre?: string;
    direccion?: string;
    stock_min_default?: number | null;
    usermod?: number | null;
  }) {
    const codneg = Number(dto.codneg);
    if (!Number.isFinite(codneg) || codneg <= 0) {
      throw new BadRequestException('codneg es requerido');
    }

    try {
      const hasDireccion = await this.hasNegocioColumn('direccion_neg');
      const hasStockMin = await this.hasNegocioColumn('stockmin_default_neg');

      // Build SET clause dynamically
      const sets: string[] = [];
      const params: Record<string, any> = { codneg, usermod: dto.usermod ?? null };

      if (dto.nombre !== undefined) {
        sets.push('nombre_neg = @nombre');
        params.nombre = String(dto.nombre).trim();
      }
      if (hasDireccion && dto.direccion !== undefined) {
        sets.push('direccion_neg = @direccion');
        params.direccion = String(dto.direccion ?? '').trim() || null;
      }
      if (hasStockMin && dto.stock_min_default !== undefined) {
        sets.push('stockmin_default_neg = @stockmin_default');
        params.stockmin_default = dto.stock_min_default;
      }

      sets.push('fechmod = GETDATE()');

      const rows = await this.sql.executeQueryParams(
        `
        UPDATE dbo.negocios
        SET ${sets.join(', ')}
        OUTPUT
          inserted.codneg_neg AS codneg,
          inserted.nombre_neg AS nombre,
          inserted.estado_neg AS estado,
          ${hasDireccion ? 'inserted.direccion_neg AS direccion,' : 'CAST(NULL AS nvarchar(250)) AS direccion,'}
          ${hasStockMin ? 'inserted.stockmin_default_neg AS stock_min_default' : 'CAST(NULL AS int) AS stock_min_default'}
        WHERE codneg_neg = @codneg;
        `,
        params,
      );

      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async actualizarStockMinimoDefaultNegocio(dto: {
    codneg: number;
    stockmin_default: number | null;
    usermod?: number;
  }) {
    const codneg = Number(dto.codneg);
    if (!Number.isFinite(codneg) || codneg <= 0) {
      throw new BadRequestException('codneg es requerido');
    }

    const value = dto.stockmin_default;
    let stockminDefault: number | null = null;
    if (value !== null) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        throw new BadRequestException('stockmin_default inválido');
      }
      stockminDefault = n;
    }

    try {
      const hasStockMin = await this.hasNegocioColumn('stockmin_default_neg');
      if (!hasStockMin) {
        return { codneg, nombre: null, stockmin_default: null };
      }

      const rows = await this.sql.executeQueryParams(
        `
        UPDATE dbo.negocios
          SET stockmin_default_neg = @stockmin_default,
              usermod = @usermod,
              fechmod = GETDATE()
        OUTPUT
          inserted.codneg_neg AS codneg,
          inserted.nombre_neg AS nombre,
          inserted.stockmin_default_neg AS stockmin_default
        WHERE codneg_neg = @codneg;
        `,
        { codneg, stockmin_default: stockminDefault, usermod: dto.usermod ?? null },
      );

      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  // --- Administración de negocios (solo SUPERADMIN; validación se hace en controller) ---

  async listarNegociosAdmin() {
    try {
      const hasDireccion = await this.hasNegocioColumn('direccion_neg');
      const hasStockMin = await this.hasNegocioColumn('stockmin_default_neg');
      const hasTelefono = await this.hasNegocioColumn('telefono_neg');
      const hasCodtng = await this.hasNegocioColumn('codtng_neg');
      const hasCodcfn = await this.hasNegocioColumn('codcfn_neg');
      const rows = await this.sql.executeQuery(
        `
        SELECT
          n.codneg_neg AS codneg,
          n.nombre_neg AS nombre,
          ${hasCodtng ? 'n.codtng_neg AS codtng,' : 'CAST(NULL AS int) AS codtng,'}
          ${hasCodcfn ? 'n.codcfn_neg AS codcfn,' : 'CAST(NULL AS int) AS codcfn,'}
          ${hasTelefono ? 'n.telefono_neg AS telefono,' : 'CAST(NULL AS nvarchar(30)) AS telefono,'}
          n.estado_neg AS estado,
          ${hasDireccion ? 'n.direccion_neg AS direccion,' : 'CAST(NULL AS nvarchar(250)) AS direccion,'}
          ${hasStockMin ? 'n.stockmin_default_neg AS stock_min_default' : 'CAST(NULL AS int) AS stock_min_default'}
        FROM dbo.negocios n
        ORDER BY n.nombre_neg;
        `,
      );

      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async obtenerMetaNegocios() {
    const hasCodtng = await this.hasNegocioColumn('codtng_neg');
    const hasCodcfn = await this.hasNegocioColumn('codcfn_neg');
    const hasDireccion = await this.hasNegocioColumn('direccion_neg');
    const hasTelefono = await this.hasNegocioColumn('telefono_neg');
    const hasStockMin = await this.hasNegocioColumn('stockmin_default_neg');

    return {
      fields: {
        nombre: true,
        estado: true,
        codtng: hasCodtng,
        codcfn: hasCodcfn,
        direccion: hasDireccion,
        telefono: hasTelefono,
        stock_min_default: hasStockMin,
      },
      foreignKeys: [
        ...(hasCodtng ? [{ key: 'codtng', label: 'Tipo de negocio' }] : []),
        ...(hasCodcfn ? [{ key: 'codcfn', label: 'Configuración de negocio' }] : []),
      ],
    };
  }

  async buscarTiposNegocio(q?: string) {
    if (!(await this.hasTable('dbo.tipos_negocio'))) return [];
    const term = String(q ?? '').trim();

    const rows = await this.sql.executeQueryParams(
      `
      SELECT TOP 50
        t.codtng_tng AS codigo,
        t.nombre_tng AS nombre
      FROM dbo.tipos_negocio t
      WHERE (@term = '' OR t.nombre_tng LIKE @q)
      ORDER BY t.nombre_tng;
      `,
      { term, q: `%${term}%` },
    );
    return Array.isArray(rows) ? rows : [];
  }

  async buscarConfiguracionNegocio(q?: string) {
    if (!(await this.hasTable('dbo.configuracion_negocio'))) return [];
    const term = String(q ?? '').trim();

    const rows = await this.sql.executeQueryParams(
      `
      SELECT TOP 50
        c.codcfn_cfn AS codigo,
        CONCAT(N'Config #', c.codcfn_cfn) AS nombre
      FROM dbo.configuracion_negocio c
      WHERE (@term = '' OR CAST(c.codcfn_cfn AS nvarchar(20)) LIKE @q)
      ORDER BY c.codcfn_cfn DESC;
      `,
      { term, q: `%${term}%` },
    );
    return Array.isArray(rows) ? rows : [];
  }

  async listarDuenosNegocio(codneg: number) {
    const codnegValue = Number(codneg);
    if (!Number.isFinite(codnegValue) || codnegValue <= 0) {
      throw new BadRequestException('codneg es requerido');
    }

    try {
      const rows = await this.sql.executeQueryParams(
        `
        SELECT
          nd.codneg_ndu AS codneg,
          nd.codusr_ndu AS codusr,
          CAST(ISNULL(nd.esprincipal_ndu, 0) AS bit) AS esprincipal,
          u.nombre_usr AS nombre_usr,
          u.estado_usr AS estado_usr,
          p.codper_per AS codper,
          p.nombre_per AS nombre_per,
          p.apellido_per AS apellido_per,
          p.email_per AS email_per
        FROM dbo.negocio_dueno nd
        INNER JOIN dbo.usuario u
          ON u.codusr_usr = nd.codusr_ndu
        LEFT JOIN dbo.personas p
          ON p.codper_per = u.codper_usr
        WHERE nd.codneg_ndu = @codneg
          AND ISNULL(nd.estado_ndu, 'A') = 'A'
        ORDER BY CASE WHEN ISNULL(nd.esprincipal_ndu, 0) = 1 THEN 0 ELSE 1 END,
                 p.nombre_per,
                 p.apellido_per,
                 u.nombre_usr;
        `,
        { codneg: codnegValue },
      );

      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async buscarUsuariosDueno(q: string) {
    const term = String(q ?? '').trim();
    if (term.length < 2) {
      throw new BadRequestException('q debe tener al menos 2 caracteres');
    }

    try {
      const rows = await this.sql.executeQueryParams(
        `
        SELECT TOP 20
          u.codusr_usr AS codusr,
          u.nombre_usr AS nombre_usr,
          CAST(ISNULL(u.esdueno_usr, 0) AS bit) AS esdueno,
          p.codper_per AS codper,
          p.nombre_per AS nombre_per,
          p.apellido_per AS apellido_per,
          p.email_per AS email_per
        FROM dbo.usuario u
        LEFT JOIN dbo.personas p
          ON p.codper_per = u.codper_usr
        WHERE u.estado_usr = 'A'
          AND ISNULL(u.esdueno_usr, 0) = 1
          AND (
            u.codusr_usr LIKE @q
            OR u.nombre_usr LIKE @q
            OR ISNULL(p.nombre_per, '') LIKE @q
            OR ISNULL(p.apellido_per, '') LIKE @q
            OR ISNULL(p.email_per, '') LIKE @q
          )
        ORDER BY p.nombre_per, p.apellido_per, u.nombre_usr;
        `,
        { q: `%${term}%` },
      );

      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async asignarDuenoNegocio(dto: {
    codneg: number;
    codusr: string;
    esprincipal?: boolean;
    audit?: number | null;
  }) {
    const codneg = Number(dto.codneg);
    const codusr = String(dto.codusr ?? '').trim();
    const audit = dto.audit ?? null;
    const esprincipal = dto.esprincipal === true;

    if (!Number.isFinite(codneg) || codneg <= 0) {
      throw new BadRequestException('codneg es requerido');
    }
    if (!codusr) {
      throw new BadRequestException('codusr es requerido');
    }

    try {
      const ownerRows = await this.sql.executeQueryParams(
        `
        SELECT TOP 1 1 AS ok
        FROM dbo.usuario u
        WHERE u.codusr_usr = @codusr
          AND u.estado_usr = 'A'
          AND ISNULL(u.esdueno_usr, 0) = 1;
        `,
        { codusr },
      );

      if (!Array.isArray(ownerRows) || ownerRows.length === 0) {
        throw new BadRequestException(
          'El usuario seleccionado no está habilitado como dueño.',
        );
      }

      await this.sql.executeQueryParams(
        `
        DECLARE @has_usercrea bit = CASE WHEN COL_LENGTH('dbo.negocio_dueno', 'usercrea') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_usermod bit = CASE WHEN COL_LENGTH('dbo.negocio_dueno', 'usermod') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_fechcrea bit = CASE WHEN COL_LENGTH('dbo.negocio_dueno', 'fechcrea') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_fechmod bit = CASE WHEN COL_LENGTH('dbo.negocio_dueno', 'fechmod') IS NULL THEN 0 ELSE 1 END;

        IF @esprincipal = 1 BEGIN
          DECLARE @sqlReset nvarchar(max) = N'UPDATE dbo.negocio_dueno SET esprincipal_ndu = 0';
          IF @has_usermod = 1 SET @sqlReset += N', usermod = @audit';
          IF @has_fechmod = 1 SET @sqlReset += N', fechmod = GETDATE()';
          SET @sqlReset += N' WHERE codneg_ndu = @codneg AND ISNULL(estado_ndu, ''A'') = ''A'';';

          EXEC sp_executesql
            @sqlReset,
            N'@codneg int, @audit int',
            @codneg = @codneg,
            @audit = @audit;
        END

        DECLARE @alreadyExists bit = CASE WHEN EXISTS (
          SELECT 1 FROM dbo.negocio_dueno WHERE codneg_ndu = @codneg AND codusr_ndu = @codusr
        ) THEN 1 ELSE 0 END;

        DECLARE @principal bit = CASE
          WHEN @esprincipal = 1 THEN 1
          WHEN EXISTS (
            SELECT 1 FROM dbo.negocio_dueno WHERE codneg_ndu = @codneg AND ISNULL(estado_ndu, 'A') = 'A'
          ) THEN 0
          ELSE 1
        END;

        IF @alreadyExists = 1
        BEGIN
          DECLARE @sqlUpdate nvarchar(max) = N'UPDATE dbo.negocio_dueno SET estado_ndu = ''A'', esprincipal_ndu = CASE WHEN @esprincipal = 1 THEN 1 ELSE ISNULL(esprincipal_ndu, 0) END';
          IF @has_usermod = 1 SET @sqlUpdate += N', usermod = @audit';
          IF @has_fechmod = 1 SET @sqlUpdate += N', fechmod = GETDATE()';
          SET @sqlUpdate += N' WHERE codneg_ndu = @codneg AND codusr_ndu = @codusr;';

          EXEC sp_executesql
            @sqlUpdate,
            N'@codneg int, @codusr varchar(50), @audit int, @esprincipal bit',
            @codneg = @codneg,
            @codusr = @codusr,
            @audit = @audit,
            @esprincipal = @esprincipal;
        END
        ELSE
        BEGIN
          DECLARE @cols nvarchar(max) = N'codneg_ndu, codusr_ndu, estado_ndu, esprincipal_ndu';
          DECLARE @vals nvarchar(max) = N'@codneg, @codusr, ''A'', @principal';

          IF @has_usercrea = 1 BEGIN
            SET @cols += N', usercrea';
            SET @vals += N', @audit';
          END
          IF @has_usermod = 1 BEGIN
            SET @cols += N', usermod';
            SET @vals += N', @audit';
          END
          IF @has_fechcrea = 1 BEGIN
            SET @cols += N', fechcrea';
            SET @vals += N', GETDATE()';
          END
          IF @has_fechmod = 1 BEGIN
            SET @cols += N', fechmod';
            SET @vals += N', GETDATE()';
          END

          DECLARE @sqlInsert nvarchar(max) =
            N'INSERT INTO dbo.negocio_dueno (' + @cols + N') VALUES (' + @vals + N');';

          EXEC sp_executesql
            @sqlInsert,
            N'@codneg int, @codusr varchar(50), @audit int, @principal bit',
            @codneg = @codneg,
            @codusr = @codusr,
            @audit = @audit,
            @principal = @principal;
        END
        `,
        { codneg, codusr, audit, esprincipal: esprincipal ? 1 : 0 },
      );

      const rows = await this.listarDuenosNegocio(codneg);
      return rows;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(this.formatError(error));
    }
  }

  async quitarDuenoNegocio(dto: {
    codneg: number;
    codusr: string;
    audit?: number | null;
  }) {
    const codneg = Number(dto.codneg);
    const codusr = String(dto.codusr ?? '').trim();
    const audit = dto.audit ?? null;

    if (!Number.isFinite(codneg) || codneg <= 0) {
      throw new BadRequestException('codneg es requerido');
    }
    if (!codusr) {
      throw new BadRequestException('codusr es requerido');
    }

    try {
      await this.sql.executeQueryParams(
        `
        DECLARE @has_usermod bit = CASE WHEN COL_LENGTH('dbo.negocio_dueno', 'usermod') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_fechmod bit = CASE WHEN COL_LENGTH('dbo.negocio_dueno', 'fechmod') IS NULL THEN 0 ELSE 1 END;

        DECLARE @sql nvarchar(max) = N'UPDATE dbo.negocio_dueno SET estado_ndu = ''I'', esprincipal_ndu = 0';
        IF @has_usermod = 1 SET @sql += N', usermod = @audit';
        IF @has_fechmod = 1 SET @sql += N', fechmod = GETDATE()';
        SET @sql += N' WHERE codneg_ndu = @codneg AND codusr_ndu = @codusr;';

        EXEC sp_executesql
          @sql,
          N'@codneg int, @codusr varchar(50), @audit int',
          @codneg = @codneg,
          @codusr = @codusr,
          @audit = @audit;

        IF NOT EXISTS (
          SELECT 1 FROM dbo.negocio_dueno WHERE codneg_ndu = @codneg AND ISNULL(estado_ndu, 'A') = 'A' AND ISNULL(esprincipal_ndu, 0) = 1
        )
        BEGIN
          UPDATE TOP (1) dbo.negocio_dueno
            SET esprincipal_ndu = 1
          WHERE codneg_ndu = @codneg AND ISNULL(estado_ndu, 'A') = 'A';
        END
        `,
        { codneg, codusr, audit },
      );

      return await this.listarDuenosNegocio(codneg);
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async crearNegocioAdmin(dto: {
    nombre: string;
    codtng?: number | null;
    codcfn?: number | null;
    telefono?: string | null;
    direccion?: string | null;
    stock_min_default?: number | null;
    estado?: 'A' | 'I';
    audit?: number | null;
  }) {
    const nombre = String(dto?.nombre ?? '').trim();
    const direccion =
      dto?.direccion === undefined ? undefined : String(dto.direccion ?? '').trim() || null;
    const stockMinRaw = dto?.stock_min_default;
    const codtngRaw = dto?.codtng;
    const codcfnRaw = dto?.codcfn;
    const telefono =
      dto?.telefono === undefined ? undefined : String(dto.telefono ?? '').trim() || null;
    const estado = (dto?.estado ?? 'A') as 'A' | 'I';
    const audit = dto?.audit ?? null;

    if (!nombre) throw new BadRequestException('nombre es requerido');
    if (estado !== 'A' && estado !== 'I') {
      throw new BadRequestException('estado inválido');
    }
    if (stockMinRaw !== undefined && stockMinRaw !== null) {
      const n = Number(stockMinRaw);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException('stock_min_default inválido');
      }
    }
    if (codtngRaw !== undefined && codtngRaw !== null) {
      const n = Number(codtngRaw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException('codtng inválido');
      }
    }
    if (codcfnRaw !== undefined && codcfnRaw !== null) {
      const n = Number(codcfnRaw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException('codcfn inválido');
      }
    }

    try {
      const hasDireccion = await this.hasNegocioColumn('direccion_neg');
      const hasTelefono = await this.hasNegocioColumn('telefono_neg');
      const hasCodtng = await this.hasNegocioColumn('codtng_neg');
      const hasCodcfn = await this.hasNegocioColumn('codcfn_neg');
      const hasStockMin = await this.hasNegocioColumn('stockmin_default_neg');
      const stockMin =
        stockMinRaw === undefined ? undefined : stockMinRaw === null ? null : Number(stockMinRaw);
      const codtng =
        codtngRaw === undefined ? undefined : codtngRaw === null ? null : Number(codtngRaw);
      const codcfn =
        codcfnRaw === undefined ? undefined : codcfnRaw === null ? null : Number(codcfnRaw);

      const rows = await this.sql.executeQueryParams(
        `
        DECLARE @has_usercrea bit = CASE WHEN COL_LENGTH('dbo.negocios', 'usercrea') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_usermod bit = CASE WHEN COL_LENGTH('dbo.negocios', 'usermod') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_fechcrea bit = CASE WHEN COL_LENGTH('dbo.negocios', 'fechcrea') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_fechmod bit = CASE WHEN COL_LENGTH('dbo.negocios', 'fechmod') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_direccion bit = CASE WHEN COL_LENGTH('dbo.negocios', 'direccion_neg') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_telefono bit = CASE WHEN COL_LENGTH('dbo.negocios', 'telefono_neg') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_codtng bit = CASE WHEN COL_LENGTH('dbo.negocios', 'codtng_neg') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_codcfn bit = CASE WHEN COL_LENGTH('dbo.negocios', 'codcfn_neg') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_stockmin bit = CASE WHEN COL_LENGTH('dbo.negocios', 'stockmin_default_neg') IS NULL THEN 0 ELSE 1 END;

        DECLARE @cols nvarchar(max) = N'nombre_neg, estado_neg';
        DECLARE @vals nvarchar(max) = N'@nombre, @estado';

        IF @has_usercrea = 1 BEGIN
          SET @cols += N', usercrea';
          SET @vals += N', @audit';
        END
        IF @has_usermod = 1 BEGIN
          SET @cols += N', usermod';
          SET @vals += N', @audit';
        END
        IF @has_fechcrea = 1 BEGIN
          SET @cols += N', fechcrea';
          SET @vals += N', GETDATE()';
        END
        IF @has_fechmod = 1 BEGIN
          SET @cols += N', fechmod';
          SET @vals += N', GETDATE()';
        END
        IF @has_direccion = 1 BEGIN
          SET @cols += N', direccion_neg';
          SET @vals += N', @direccion';
        END
        IF @has_telefono = 1 BEGIN
          SET @cols += N', telefono_neg';
          SET @vals += N', @telefono';
        END
        IF @has_codtng = 1 BEGIN
          SET @cols += N', codtng_neg';
          SET @vals += N', @codtng';
        END
        IF @has_codcfn = 1 BEGIN
          SET @cols += N', codcfn_neg';
          SET @vals += N', @codcfn';
        END
        IF @has_stockmin = 1 BEGIN
          SET @cols += N', stockmin_default_neg';
          SET @vals += N', @stock_min_default';
        END

        DECLARE @sql nvarchar(max) =
          N'INSERT INTO dbo.negocios (' + @cols + N') '
          + N'OUTPUT inserted.codneg_neg AS codneg, inserted.nombre_neg AS nombre, '
          + N'       ' + CASE WHEN @has_codtng = 1 THEN N'inserted.codtng_neg' ELSE N'CAST(NULL AS int)' END + N' AS codtng, '
          + N'       ' + CASE WHEN @has_codcfn = 1 THEN N'inserted.codcfn_neg' ELSE N'CAST(NULL AS int)' END + N' AS codcfn, '
          + N'       ' + CASE WHEN @has_telefono = 1 THEN N'inserted.telefono_neg' ELSE N'CAST(NULL AS nvarchar(30))' END + N' AS telefono, '
          + N'       inserted.estado_neg AS estado, '
          + N'       ' + CASE WHEN @has_direccion = 1 THEN N'inserted.direccion_neg' ELSE N'CAST(NULL AS nvarchar(250))' END + N' AS direccion, '
          + N'       ' + CASE WHEN @has_stockmin = 1 THEN N'inserted.stockmin_default_neg' ELSE N'CAST(NULL AS int)' END + N' AS stock_min_default '
          + N'VALUES (' + @vals + N');';

        EXEC sp_executesql
          @sql,
          N'@nombre nvarchar(200), @estado char(1), @audit int, @direccion nvarchar(250), @telefono nvarchar(30), @codtng int, @codcfn int, @stock_min_default int',
          @nombre = @nombre,
          @estado = @estado,
          @audit = @audit,
          @direccion = @direccion,
          @telefono = @telefono,
          @codtng = @codtng,
          @codcfn = @codcfn,
          @stock_min_default = @stock_min_default;
        `,
        {
          nombre,
          estado,
          audit,
          direccion: hasDireccion ? direccion ?? null : null,
          telefono: hasTelefono ? telefono ?? null : null,
          codtng: hasCodtng ? (codtng ?? null) : null,
          codcfn: hasCodcfn ? (codcfn ?? null) : null,
          stock_min_default: stockMin === undefined ? null : stockMin,
        },
      );

      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async inactivarNegocio(dto: { codneg: number; audit?: number | null }) {
    const codneg = Number(dto.codneg);
    if (!Number.isFinite(codneg) || codneg <= 0) {
      throw new BadRequestException('codneg es requerido');
    }
    try {
      const rows = await this.sql.executeQueryParams(
        `UPDATE dbo.negocios
          SET estado_neg = 'I', fechmod = GETDATE()
          OUTPUT inserted.codneg_neg AS codneg, inserted.nombre_neg AS nombre, inserted.estado_neg AS estado
          WHERE codneg_neg = @codneg;`,
        { codneg },
      );
      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async reactivarNegocio(dto: { codneg: number; audit?: number | null }) {
    const codneg = Number(dto.codneg);
    if (!Number.isFinite(codneg) || codneg <= 0) {
      throw new BadRequestException('codneg es requerido');
    }
    try {
      const rows = await this.sql.executeQueryParams(
        `UPDATE dbo.negocios
          SET estado_neg = 'A', fechmod = GETDATE()
          OUTPUT inserted.codneg_neg AS codneg, inserted.nombre_neg AS nombre, inserted.estado_neg AS estado
          WHERE codneg_neg = @codneg;`,
        { codneg },
      );
      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }

  async actualizarNegocioAdmin(dto: {
    codneg: number;
    nombre?: string;
    codtng?: number | null;
    codcfn?: number | null;
    telefono?: string | null;
    direccion?: string | null;
    stock_min_default?: number | null;
    estado?: 'A' | 'I';
    audit?: number | null;
  }) {
    const codneg = Number(dto?.codneg);
    const audit = dto?.audit ?? null;
    const nombre = dto?.nombre !== undefined ? String(dto.nombre).trim() : undefined;
    const direccion =
      dto?.direccion !== undefined ? String(dto.direccion ?? '').trim() || null : undefined;
    const telefono =
      dto?.telefono !== undefined ? String(dto.telefono ?? '').trim() || null : undefined;
    const codtngRaw = dto?.codtng;
    const codcfnRaw = dto?.codcfn;
    const stockMinRaw = dto?.stock_min_default;
    const estado = dto?.estado as 'A' | 'I' | undefined;

    if (!Number.isFinite(codneg) || codneg <= 0) {
      throw new BadRequestException('codneg es requerido');
    }
    if (nombre !== undefined && !nombre) {
      throw new BadRequestException('nombre inválido');
    }
    if (estado !== undefined && estado !== 'A' && estado !== 'I') {
      throw new BadRequestException('estado inválido');
    }
    if (stockMinRaw !== undefined && stockMinRaw !== null) {
      const n = Number(stockMinRaw);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException('stock_min_default inválido');
      }
    }
    if (codtngRaw !== undefined && codtngRaw !== null) {
      const n = Number(codtngRaw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException('codtng inválido');
      }
    }
    if (codcfnRaw !== undefined && codcfnRaw !== null) {
      const n = Number(codcfnRaw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException('codcfn inválido');
      }
    }

    try {
      const hasDireccion = await this.hasNegocioColumn('direccion_neg');
      const hasTelefono = await this.hasNegocioColumn('telefono_neg');
      const stockMin =
        stockMinRaw === undefined ? undefined : stockMinRaw === null ? null : Number(stockMinRaw);
      const codtng =
        codtngRaw === undefined ? undefined : codtngRaw === null ? null : Number(codtngRaw);
      const codcfn =
        codcfnRaw === undefined ? undefined : codcfnRaw === null ? null : Number(codcfnRaw);

      const rows = await this.sql.executeQueryParams(
        `
        DECLARE @has_usermod bit = CASE WHEN COL_LENGTH('dbo.negocios', 'usermod') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_fechmod bit = CASE WHEN COL_LENGTH('dbo.negocios', 'fechmod') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_direccion bit = CASE WHEN COL_LENGTH('dbo.negocios', 'direccion_neg') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_telefono bit = CASE WHEN COL_LENGTH('dbo.negocios', 'telefono_neg') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_codtng bit = CASE WHEN COL_LENGTH('dbo.negocios', 'codtng_neg') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_codcfn bit = CASE WHEN COL_LENGTH('dbo.negocios', 'codcfn_neg') IS NULL THEN 0 ELSE 1 END;
        DECLARE @has_stockmin bit = CASE WHEN COL_LENGTH('dbo.negocios', 'stockmin_default_neg') IS NULL THEN 0 ELSE 1 END;

        DECLARE @set nvarchar(max) = N'';
        IF @nombre IS NOT NULL BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'nombre_neg = @nombre';
        END
        IF @has_direccion = 1 AND @has_direccion_input = 1 BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'direccion_neg = @direccion';
        END
        IF @has_telefono = 1 AND @has_telefono_input = 1 BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'telefono_neg = @telefono';
        END
        IF @has_codtng = 1 AND @has_codtng_input = 1 BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'codtng_neg = @codtng';
        END
        IF @has_codcfn = 1 AND @has_codcfn_input = 1 BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'codcfn_neg = @codcfn';
        END
        IF @has_stockmin = 1 AND @has_stockmin_input = 1 BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'stockmin_default_neg = @stock_min_default';
        END
        IF @estado IS NOT NULL BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'estado_neg = @estado';
        END
        IF @has_usermod = 1 BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'usermod = @audit';
        END
        IF @has_fechmod = 1 BEGIN
          SET @set = @set + CASE WHEN LEN(@set) = 0 THEN N'' ELSE N', ' END + N'fechmod = GETDATE()';
        END

        IF LEN(@set) = 0
          THROW 50001, 'No hay cambios para aplicar', 1;

        DECLARE @sql nvarchar(max) =
          N'UPDATE dbo.negocios SET ' + @set + N' '
          + N'OUTPUT inserted.codneg_neg AS codneg, inserted.nombre_neg AS nombre, '
          + N'       ' + CASE WHEN @has_codtng = 1 THEN N'inserted.codtng_neg' ELSE N'CAST(NULL AS int)' END + N' AS codtng, '
          + N'       ' + CASE WHEN @has_codcfn = 1 THEN N'inserted.codcfn_neg' ELSE N'CAST(NULL AS int)' END + N' AS codcfn, '
          + N'       ' + CASE WHEN @has_telefono = 1 THEN N'inserted.telefono_neg' ELSE N'CAST(NULL AS nvarchar(30))' END + N' AS telefono, '
          + N'       inserted.estado_neg AS estado, '
          + N'       ' + CASE WHEN @has_direccion = 1 THEN N'inserted.direccion_neg' ELSE N'CAST(NULL AS nvarchar(250))' END + N' AS direccion, '
          + N'       ' + CASE WHEN @has_stockmin = 1 THEN N'inserted.stockmin_default_neg' ELSE N'CAST(NULL AS int)' END + N' AS stock_min_default '
          + N'WHERE codneg_neg = @codneg;';

        EXEC sp_executesql
          @sql,
          N'@codneg int, @nombre nvarchar(200), @estado char(1), @audit int, @direccion nvarchar(250), @telefono nvarchar(30), @codtng int, @codcfn int, @stock_min_default int, @has_direccion_input bit, @has_telefono_input bit, @has_codtng_input bit, @has_codcfn_input bit, @has_stockmin_input bit',
          @codneg = @codneg,
          @nombre = @nombre,
          @estado = @estado,
          @audit = @audit,
          @direccion = @direccion,
          @telefono = @telefono,
          @codtng = @codtng,
          @codcfn = @codcfn,
          @stock_min_default = @stock_min_default,
          @has_direccion_input = @has_direccion_input,
          @has_telefono_input = @has_telefono_input,
          @has_codtng_input = @has_codtng_input,
          @has_codcfn_input = @has_codcfn_input,
          @has_stockmin_input = @has_stockmin_input;
        `,
        {
          codneg,
          nombre: nombre === undefined ? null : nombre,
          direccion: hasDireccion ? (direccion === undefined ? null : direccion) : null,
          telefono: hasTelefono ? (telefono === undefined ? null : telefono) : null,
          codtng: codtng === undefined ? null : codtng,
          codcfn: codcfn === undefined ? null : codcfn,
          stock_min_default:
            stockMin === undefined ? null : stockMin,
          has_direccion_input: direccion !== undefined ? 1 : 0,
          has_telefono_input: telefono !== undefined ? 1 : 0,
          has_codtng_input: codtngRaw !== undefined ? 1 : 0,
          has_codcfn_input: codcfnRaw !== undefined ? 1 : 0,
          has_stockmin_input: stockMinRaw !== undefined ? 1 : 0,
          estado: estado === undefined ? null : estado,
          audit,
        },
      );

      return rows?.[0] ?? null;
    } catch (error) {
      throw new BadRequestException(this.formatError(error));
    }
  }
}
