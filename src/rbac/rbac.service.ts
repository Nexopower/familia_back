import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import type { JwtPayload } from 'src/auth/auth.types';
import { AuthzService } from 'src/authz/authz.service';
import { SqlService } from 'src/sql/sql.service';
import { getRbacCatalog } from './rbac.manifest';
import { PERMISOS } from './rbac.permisos';

@Injectable()
export class RbacService {
  constructor(
    private readonly sql: SqlService,
    private readonly authService: AuthService,
    private readonly authz: AuthzService,
  ) {}

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

    if (esSuperAdmin) {
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

    return rows?.[0] ?? { codprm: null };
  }

  async permisosSync(payload: JwtPayload | undefined) {
    await this.assertSuperAdmin(payload);

    if (!PERMISOS.length) {
      throw new BadRequestException('No hay permisos en el catálogo RBAC');
    }

    for (const p of PERMISOS) {
      const clave = String(p?.clave ?? '').trim();
      const nombre = String(p?.nombre ?? '').trim();
      const detalle = p?.detalle ?? null;

      if (!clave || !nombre) continue;

      await this.sql.executeQueryParams(
        `
          DECLARE @codprm_out INT;
          EXEC dbo.sp_permiso_upsert
            @clave = @clave,
            @nombre = @nombre,
            @detalle = @detalle,
            @usercrea = @usercrea,
            @codprm_out = @codprm_out OUTPUT;
        `,
        {
          clave,
          nombre,
          detalle,
          usercrea: payload?.audit ?? null,
        },
      );
    }

    // Asegura que los roles SUPERADMIN tengan todos los permisos activos del catálogo.
    const superAdminRoles = await this.sql.executeQueryParams(
      `
        SELECT codrol_rol AS codrol
        FROM dbo.roles
        WHERE nombre_rol = N'SUPERADMIN';
      `,
      {},
    );

    for (const r of superAdminRoles || []) {
      const codrol = Number(r?.codrol);
      if (!Number.isFinite(codrol) || codrol <= 0) continue;

      for (const p of PERMISOS) {
        const clave = String(p?.clave ?? '').trim();
        if (!clave) continue;

        await this.sql.executeQueryParams(
          `EXEC dbo.sp_rol_permiso_set @codrol=@codrol, @clave_permiso=@clave_permiso, @estado=@estado, @usercrea=@usercrea;`,
          {
            codrol,
            clave_permiso: clave,
            estado: 'A',
            usercrea: payload?.audit ?? null,
          },
        );
      }
    }

    const catalog = getRbacCatalog();
    return {
      ok: true,
      total: PERMISOS.length,
      catalogSource: catalog.source,
      superAdminRolesUpdated: (superAdminRoles || []).length,
    };
  }

  async rolPermisoSet(
    payload: JwtPayload | undefined,
    input: { codrol: number; clavePermiso: string; estado?: 'A' | 'I' },
  ) {
    await this.assertSuperAdmin(payload);

    const codrol = Number(input?.codrol);
    const clavePermiso = String(input?.clavePermiso ?? '').trim();
    const estado = (input?.estado ?? 'A') as 'A' | 'I';

    if (!Number.isFinite(codrol) || !codrol) {
      throw new BadRequestException('codrol es requerido');
    }
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
