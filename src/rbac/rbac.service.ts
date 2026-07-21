import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AuthService } from 'src/auth/auth.service';
import type { JwtPayload } from 'src/auth/auth.types';
import { AuthzService } from 'src/authz/authz.service';
import { SqlService } from 'src/sql/sql.service';
import { getRbacCatalog } from './rbac.manifest';
import { PERMISOS } from './rbac.permisos';
import { PermisoDiscoveryService } from './permiso-discovery.service';

@Injectable()
export class RbacService {
  constructor(
    private readonly sql: SqlService,
    private readonly authService: AuthService,
    private readonly authz: AuthzService,
    private readonly discovery: PermisoDiscoveryService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private readonly VERBOS: Record<string, string> = {
    VER: 'Ver', CREAR: 'Crear', EDITAR: 'Editar', ELIMINAR: 'Eliminar',
    GESTIONAR: 'Gestionar', CERRAR: 'Cerrar', CAMBIAR: 'Cambiar',
    CONFIGURAR: 'Configurar', REPROGRAMAR: 'Reprogramar',
  };

  private moduloDeClave(clave: string): string {
    if (!clave || clave === '*') return 'GLOBAL';
    return clave.includes('.') ? clave.split('.')[0] : 'GLOBAL';
  }

  private nombreDeClave(clave: string): string {
    if (clave === '*') return 'Acceso total';
    const parts = clave.split('.');
    const modulo = parts[0];
    const accion = this.VERBOS[parts[parts.length - 1]] ?? parts[parts.length - 1];
    return `${accion} ${modulo.toLowerCase()}`;
  }

  /** Lista los permisos reales de la BD (fuente para el catálogo del frontend). */
  async listarPermisos() {
    const cacheado = await this.cache.get('cat:permisos');
    if (cacheado) return cacheado;

    const rows =
      (await this.sql.executeQueryParams(
        `SELECT codprm_prm AS codprm, clave_prm AS clave, nombre_prm AS nombre
         FROM dbo.permisos
         WHERE estado_prm = 'A'
         ORDER BY clave_prm;`,
        {},
      )) ?? [];
    const permisos = rows.map((r: any) => ({
      codprm: r.codprm,
      clave: r.clave,
      nombre: r.nombre,
      modulo: this.moduloDeClave(String(r.clave)),
    }));
    await this.cache.set('cat:permisos', permisos, 10 * 60 * 1000);
    return permisos;
  }

  async catalog() {
    const { modulos, moduloPermisos } = getRbacCatalog();
    return {
      modulos,
      moduloPermisos,
    };
  }

  private normalizeCodneg(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private assertPayload(payload: JwtPayload | undefined) {
    const codusr = String(payload?.sub ?? '').trim();
    if (!codusr) throw new ForbiddenException('Token inválido');
    return codusr;
  }

  async visibleModules(payload: JwtPayload | undefined, codnegRaw?: unknown) {
    const codusr = this.assertPayload(payload);
    const codnegFromToken = this.normalizeCodneg(payload?.codneg);
    const codnegFromQuery = this.normalizeCodneg(codnegRaw);
    const codneg = codnegFromQuery ?? codnegFromToken;

    const esSuperAdmin = await this.authService.isSuperAdmin(codusr);

    // Caso dashboard general (sin negocio seleccionado)
    if (!codneg) {
      if (esSuperAdmin) {
        const { modulos } = getRbacCatalog();
        return {
          codneg: null,
          modules: modulos.map((m) => ({
            ...m,
            enabled: true,
            visible: true,
          })),
        };
      }

      // Para dueños/loginmulti: el frontend no debe renderizar módulos hasta elegir negocio.
      return { codneg: null, modules: [] as unknown[] };
    }

    // Validar pertenencia (admin bypass)
    await this.authService.assertCanAccessNegocio(payload, codneg);

    // SUPERADMIN o dueño del negocio: todos los módulos visibles.
    const esDueno = esSuperAdmin
      ? false
      : await this.authz.esDuenoDeNegocio(codusr, codneg);
    if (esSuperAdmin || esDueno) {
      const { modulos } = getRbacCatalog();
      return {
        codneg,
        modules: modulos.map((m) => ({
          ...m,
          enabled: true,
          visible: true,
        })),
      };
    }

    const { modulos, moduloPermisos } = getRbacCatalog();
    const modules = await Promise.all(
      modulos.map(async (m) => {
        const required = moduloPermisos[m.key] ?? [];
        const visible = await this.hasAnyPermiso(codusr, codneg, required);
        return {
          ...m,
          enabled: true,
          visible,
        };
      }),
    );

    return { codneg, modules };
  }

  private async hasAnyPermiso(
    codusr: string,
    codneg: number,
    permisos: string[],
  ): Promise<boolean> {
    for (const permiso of permisos) {
      const ok = await this.authz.tienePermiso(codusr, codneg, permiso as any);
      if (ok) return true;
    }
    return false;
  }

  private async assertSuperAdmin(payload: JwtPayload | undefined) {
    const codusr = this.assertPayload(payload);
    const ok = await this.authService.isSuperAdmin(codusr);
    if (!ok) throw new ForbiddenException('Solo SUPERADMIN');
    return codusr;
  }

  /** Permite SUPERADMIN o dueños (gestionan los roles de SUS negocios). */
  private async assertAdminODueno(payload: JwtPayload | undefined) {
    const codusr = this.assertPayload(payload);
    const esSuperAdmin = await this.authService.isSuperAdmin(codusr);
    if (esSuperAdmin) return { codusr, esSuperAdmin };
    const flags = await this.authService.getUserFlags(codusr);
    if (!flags?.esdueno) {
      throw new ForbiddenException('Solo SUPERADMIN o dueños de negocio');
    }
    return { codusr, esSuperAdmin: false };
  }

  /** Negocio dueño del rol (NULL = rol global). */
  private async getRolNegocio(codrol: number): Promise<number | null> {
    const rows = await this.sql.executeQueryParams(
      `SELECT codneg_rol AS codneg FROM dbo.roles WHERE codrol_rol = @codrol;`,
      { codrol },
    );
    if (!rows?.length) throw new BadRequestException('Rol no existe');
    const v = rows[0]?.codneg;
    return v == null ? null : Number(v);
  }

  /** Valida que el actor pueda gestionar (editar) el rol: admin todo; dueño solo roles de sus negocios. */
  private async assertPuedeGestionarRol(
    payload: JwtPayload | undefined,
    codrol: number,
  ) {
    const { codusr, esSuperAdmin } = await this.assertAdminODueno(payload);
    if (esSuperAdmin) return { codusr, esSuperAdmin };
    const codnegRol = await this.getRolNegocio(codrol);
    if (codnegRol === null) {
      throw new ForbiddenException('Los roles globales solo los gestiona SUPERADMIN');
    }
    const esDueno = await this.authz.esDuenoDeNegocio(codusr, codnegRol);
    if (!esDueno) {
      throw new ForbiddenException('Solo puedes gestionar roles de tus negocios');
    }
    return { codusr, esSuperAdmin };
  }

  async permisoUpsert(
    payload: JwtPayload | undefined,
    input: { clave: string; nombre: string; detalle?: string },
  ) {
    await this.assertSuperAdmin(payload);

    const clave = String(input?.clave ?? '').trim();
    const nombre = String(input?.nombre ?? '').trim();
    const detalle = input?.detalle ?? null;

    if (!clave) throw new BadRequestException('clave es requerida');
    if (!nombre) throw new BadRequestException('nombre es requerido');

    const rows = await this.sql.executeQueryParams(
      `
        DECLARE @codprm_out INT;
        EXEC dbo.sp_permiso_upsert
          @clave = @clave,
          @nombre = @nombre,
          @detalle = @detalle,
          @usercrea = @usercrea,
          @codprm_out = @codprm_out OUTPUT;
        SELECT @codprm_out AS codprm;
      `,
      {
        clave,
        nombre,
        detalle,
        usercrea: payload?.audit ?? null,
      },
    );

    await this.cache.del('cat:permisos');
    return rows?.[0] ?? { codprm: null };
  }

  async permisosSync(payload: JwtPayload | undefined) {
    await this.assertSuperAdmin(payload);

    // 1) Fuente de verdad: permisos descubiertos del código (@RequirePermiso)
    //    combinados con el manifiesto (para nombres bonitos y permisos que no
    //    estén ligados a un endpoint). '*' siempre presente (comodín).
    const descubiertas = this.discovery.descubrirClaves();
    const manifiesto = new Map<string, { nombre: string; detalle: string | null }>();
    for (const p of PERMISOS) {
      manifiesto.set(p.clave, { nombre: p.nombre, detalle: p.detalle ?? null });
    }

    const clavesSet = new Set<string>([
      '*',
      ...descubiertas,
      ...PERMISOS.map((p) => p.clave),
    ]);

    const desired = Array.from(clavesSet)
      .map((c) => String(c ?? '').trim())
      .filter(Boolean)
      .map((clave) => {
        const m = manifiesto.get(clave);
        return {
          clave,
          nombre: m?.nombre ?? this.nombreDeClave(clave),
          detalle:
            m?.detalle ??
            (clave === '*' ? 'Permiso comodín (acceso total)' : null),
        };
      });

    // 2) Upsert (crea/actualiza/reactiva) cada permiso deseado.
    for (const d of desired) {
      await this.sql.executeQueryParams(
        `DECLARE @codprm_out INT;
         EXEC dbo.sp_permiso_upsert
           @clave = @clave, @nombre = @nombre, @detalle = @detalle,
           @usercrea = @usercrea, @codprm_out = @codprm_out OUTPUT;`,
        {
          clave: d.clave,
          nombre: d.nombre,
          detalle: d.detalle,
          usercrea: payload?.audit ?? null,
        },
      );
    }

    // 3) Desactiva (no borra) los permisos que ya no existen en el sistema.
    const claves = desired.map((d) => d.clave);
    const params: Record<string, any> = { usermod: payload?.audit ?? null };
    claves.forEach((c, i) => (params[`c${i}`] = c));
    const placeholders = claves.map((_, i) => `@c${i}`).join(', ');
    const orphanRows = await this.sql.executeQueryParams(
      `UPDATE dbo.permisos
          SET estado_prm = 'I', usermod = @usermod, fechmod = getdate()
        WHERE estado_prm = 'A' AND clave_prm NOT IN (${placeholders});
       SELECT @@ROWCOUNT AS desactivados;`,
      params,
    );
    const desactivados = Number(orphanRows?.[0]?.desactivados ?? 0);

    // 4) SUPERADMIN siempre con todos los permisos vigentes.
    const superAdminRoles =
      (await this.sql.executeQueryParams(
        `SELECT codrol_rol AS codrol FROM dbo.roles WHERE nombre_rol = N'SUPERADMIN';`,
        {},
      )) ?? [];

    for (const r of superAdminRoles) {
      const codrol = Number(r?.codrol);
      if (!Number.isFinite(codrol) || codrol <= 0) continue;
      for (const d of desired) {
        await this.sql.executeQueryParams(
          `EXEC dbo.sp_rol_permiso_set @codrol=@codrol, @clave_permiso=@clave_permiso, @estado=@estado, @usercrea=@usercrea;`,
          {
            codrol,
            clave_permiso: d.clave,
            estado: 'A',
            usercrea: payload?.audit ?? null,
          },
        );
      }
    }

    await this.cache.del('cat:permisos');
    return {
      ok: true,
      total: desired.length,
      descubiertos: descubiertas.length,
      desactivados,
      superAdminRolesUpdated: superAdminRoles.length,
    };
  }

  async rolPermisoSet(
    payload: JwtPayload | undefined,
    input: { codrol: number; clavePermiso: string; estado?: 'A' | 'I' },
  ) {
    const codrol = Number(input?.codrol);
    const clavePermiso = String(input?.clavePermiso ?? '').trim();
    const estado = (input?.estado ?? 'A') as 'A' | 'I';

    if (!Number.isFinite(codrol) || !codrol) {
      throw new BadRequestException('codrol es requerido');
    }
    await this.assertPuedeGestionarRol(payload, codrol);
    if (!clavePermiso) {
      throw new BadRequestException('clavePermiso es requerido');
    }

    await this.sql.executeQueryParams(
      `EXEC dbo.sp_rol_permiso_set @codrol=@codrol, @clave_permiso=@clave_permiso, @estado=@estado, @usercrea=@usercrea;`,
      {
        codrol,
        clave_permiso: clavePermiso,
        estado,
        usercrea: payload?.audit ?? null,
      },
    );

    return { ok: true };
  }

  async listarRoles(payload: JwtPayload | undefined) {
    const { codusr, esSuperAdmin } = await this.assertAdminODueno(payload);

    // Admin ve todos; dueño ve los globales + los de sus negocios.
    const filtro = esSuperAdmin
      ? ''
      : `WHERE r.codneg_rol IS NULL
           OR r.codneg_rol IN (
             SELECT nd.codneg_ndu FROM dbo.negocio_dueno nd
             WHERE nd.codusr_ndu = @codusr AND ISNULL(nd.estado_ndu, 'A') = 'A'
           )`;

    return (
      (await this.sql.executeQueryParams(
        `
          SELECT
            r.codrol_rol AS codrol,
            r.nombre_rol AS nombre,
            r.detalle_rol AS detalle,
            r.codneg_rol AS codneg,
            n.nombre_neg AS negocio_nombre,
            r.fechcrea,
            r.fechmod
          FROM dbo.roles r
          LEFT JOIN dbo.negocios n ON n.codneg_neg = r.codneg_rol
          ${filtro}
          ORDER BY CASE WHEN r.codneg_rol IS NULL THEN 0 ELSE 1 END, n.nombre_neg, r.nombre_rol;
        `,
        { codusr },
      )) ?? []
    );
  }

  /**
   * Crea un rol por negocio. `codnegs` = negocios donde se creará (una copia
   * independiente por negocio, mismo nombre). Vacío = rol global (solo admin).
   */
  async rolCrear(
    payload: JwtPayload | undefined,
    input: { nombre: string; detalle?: string | null; codnegs?: number[] },
  ) {
    const { codusr, esSuperAdmin } = await this.assertAdminODueno(payload);
    const nombre = String(input?.nombre ?? '').trim();
    const detalle = input?.detalle ?? null;
    if (!nombre) throw new BadRequestException('nombre es requerido');

    const codnegs = Array.from(
      new Set(
        (input?.codnegs ?? [])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    // Validar que los negocios existan (la sesión del navegador puede traer
    // una lista vieja si la BD cambió después del login).
    for (const neg of codnegs) {
      const existe = await this.sql.executeQueryParams(
        `SELECT TOP 1 1 AS ok FROM dbo.negocios WHERE codneg_neg = @neg AND estado_neg = 'A';`,
        { neg },
      );
      if (!existe?.length) {
        throw new BadRequestException(
          `El negocio #${neg} no existe o está inactivo. Recarga la página o vuelve a iniciar sesión.`,
        );
      }
    }

    if (!esSuperAdmin) {
      if (!codnegs.length) {
        throw new BadRequestException(
          'Selecciona al menos un negocio para crear el rol',
        );
      }
      for (const neg of codnegs) {
        const ok = await this.authz.esDuenoDeNegocio(codusr, neg);
        if (!ok) {
          throw new ForbiddenException(
            'Solo puedes crear roles en negocios de los que eres dueño',
          );
        }
      }
    }

    try {
      const creados: any[] = [];
      // Sin negocios (solo admin) → rol global único.
      const destinos: Array<number | null> = codnegs.length ? codnegs : [null];
      for (const neg of destinos) {
        const rows = await this.sql.executeQueryParams(
          `
            INSERT INTO dbo.roles (nombre_rol, detalle_rol, codneg_rol, usercrea)
            OUTPUT
              inserted.codrol_rol AS codrol,
              inserted.nombre_rol AS nombre,
              inserted.detalle_rol AS detalle,
              inserted.codneg_rol AS codneg
            VALUES (@nombre, @detalle, @codneg, @usercrea);
          `,
          { nombre, detalle, codneg: neg, usercrea: payload?.audit ?? null },
        );
        if (rows?.[0]) creados.push(rows[0]);
      }
      return { creados, total: creados.length };
    } catch (e: any) {
      // UX_roles_negocio_nombre
      throw new BadRequestException(
        e?.originalError?.info?.message || e?.message || 'No se pudo crear el rol',
      );
    }
  }

  async rolPermisos(payload: JwtPayload | undefined, codrolRaw: number) {
    const codrol = Number(codrolRaw);
    if (!Number.isFinite(codrol) || !codrol) {
      throw new BadRequestException('codrol es requerido');
    }
    await this.assertPuedeGestionarRol(payload, codrol);

    const rows =
      (await this.sql.executeQueryParams(
        `
          SELECT
            p.codprm_prm AS codprm,
            p.clave_prm AS clave,
            p.nombre_prm AS nombre,
            p.detalle_prm AS detalle,
            CAST(
              CASE WHEN rp.codrpe_rpe IS NULL THEN 'I' ELSE rp.estado_rpe END
              AS char(1)
            ) AS estado
          FROM dbo.permisos p
          LEFT JOIN dbo.rol_permiso rp
            ON rp.codprm_rpe = p.codprm_prm
           AND rp.codrol_rpe = @codrol
          WHERE p.estado_prm = 'A'
          ORDER BY p.clave_prm;
        `,
        { codrol },
      )) ?? [];

    return {
      codrol,
      permisos: rows,
    };
  }

  async usuarioRolGlobalSet(
    payload: JwtPayload | undefined,
    input: { codusr: string; codrol: number; estado?: 'A' | 'I' },
  ) {
    await this.assertSuperAdmin(payload);

    const codusr = String(input?.codusr ?? '').trim();
    const codrol = Number(input?.codrol);
    const estado = (input?.estado ?? 'A') as 'A' | 'I';

    if (!codusr) throw new BadRequestException('codusr es requerido');
    if (!Number.isFinite(codrol) || !codrol) {
      throw new BadRequestException('codrol es requerido');
    }

    await this.sql.executeQueryParams(
      `EXEC dbo.sp_usuario_rol_global_set @codusr=@codusr, @codrol=@codrol, @estado=@estado, @usercrea=@usercrea;`,
      {
        codusr,
        codrol,
        estado,
        usercrea: payload?.audit ?? null,
      },
    );

    return { ok: true };
  }
}
