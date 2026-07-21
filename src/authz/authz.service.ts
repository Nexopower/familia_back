import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';

@Injectable()
export class AuthzService {
  private fnUiTienePermisoExists: boolean | null = null;
  private fnAuthzTienePermisoExists: boolean | null = null;
  private fnUsrEsDescendienteExists: boolean | null = null;

  constructor(private readonly sql: SqlService) {}

  private async hasDbObject(objectName: string, objectType: string) {
    const rows = await this.sql.executeQueryParams(
      `SELECT OBJECT_ID(@name, @type) AS id;`,
      { name: objectName, type: objectType },
    );
    return Boolean(rows?.[0]?.id);
  }

  private async ensureFunctionFlags() {
    if (this.fnUiTienePermisoExists === null) {
      this.fnUiTienePermisoExists = await this.hasDbObject(
        'dbo.fn_ui_tiene_permiso',
        'FN',
      );
    }
    if (this.fnAuthzTienePermisoExists === null) {
      this.fnAuthzTienePermisoExists = await this.hasDbObject(
        'dbo.fn_authz_tiene_permiso',
        'FN',
      );
    }
    if (this.fnUsrEsDescendienteExists === null) {
      this.fnUsrEsDescendienteExists = await this.hasDbObject(
        'dbo.fn_usr_es_descendiente',
        'FN',
      );
    }
  }

  /**
   * Permiso por clave (ej: 'PRODUCTOS.VER').
   * Si existe fn_ui_tiene_permiso: se deriva componente/acción desde la clave.
   * Si no, usa fn_authz_tiene_permiso(@codusr, @codneg, @clave).
   */
  async tienePermiso(
    codusr: string,
    codneg: number | null,
    clavePermiso: string,
  ): Promise<boolean> {
    const cusr = String(codusr ?? '').trim();
    const clave = String(clavePermiso ?? '').trim();

    if (!cusr) throw new BadRequestException('codusr es requerido');
    if (!clave) throw new BadRequestException('clavePermiso es requerido');

    await this.ensureFunctionFlags();

    if (this.fnUiTienePermisoExists) {
      const [componente, accion] = clave.split('.', 2);
      if (!componente || !accion) {
        throw new BadRequestException(
          'clavePermiso debe tener formato COMPONENTE.ACCION (ej: PRODUCTOS.VER)',
        );
      }
      const rows = await this.sql.executeQueryParams(
        `SELECT dbo.fn_ui_tiene_permiso(@codusr, @codneg, @componente, @accion) AS ok;`,
        {
          codusr: cusr,
          codneg: codneg ?? null,
          componente,
          accion,
        },
      );
      return Boolean(rows?.[0]?.ok);
    }

    if (this.fnAuthzTienePermisoExists) {
      const rows = await this.sql.executeQueryParams(
        `SELECT dbo.fn_authz_tiene_permiso(@codusr, @codneg, @clave_permiso) AS ok;`,
        {
          codusr: cusr,
          codneg: codneg ?? null,
          clave_permiso: clave,
        },
      );
      return Boolean(rows?.[0]?.ok);
    }

    // Sin funciones de autorización: por seguridad, denegar.
    return false;
  }

  /** ¿El usuario es dueño (activo) del negocio? Los dueños tienen acceso total a sus negocios. */
  async esDuenoDeNegocio(codusr: string, codneg: number): Promise<boolean> {
    const rows = await this.sql.executeQueryParams(
      `SELECT TOP 1 1 AS ok
       FROM dbo.negocio_dueno
       WHERE codusr_ndu = @codusr AND codneg_ndu = @codneg AND ISNULL(estado_ndu, 'A') = 'A';`,
      { codusr, codneg },
    );
    return Boolean(rows?.length);
  }

  async assertPermiso(
    codusr: string,
    codneg: number | null,
    clavePermiso: string,
  ) {
    const ok = await this.tienePermiso(codusr, codneg, clavePermiso);
    if (!ok) throw new ForbiddenException('No tiene permisos');
  }

  /**
   * Jerarquía: si existe fn_usr_es_descendiente la usa; si no, hace fallback con CTE.
   */
  async esDescendiente(
    codusrPadre: string,
    codusrObjetivo: string,
  ): Promise<boolean> {
    const padre = String(codusrPadre ?? '').trim();
    const objetivo = String(codusrObjetivo ?? '').trim();

    if (!padre || !objetivo) return false;
    if (padre === objetivo) return true;

    await this.ensureFunctionFlags();

    if (this.fnUsrEsDescendienteExists) {
      const rows = await this.sql.executeQueryParams(
        `SELECT dbo.fn_usr_es_descendiente(@padre, @objetivo) AS ok;`,
        { padre, objetivo },
      );
      return Boolean(rows?.[0]?.ok);
    }

    const rows = await this.sql.executeQueryParams(
      `
        WITH tree AS (
          SELECT u.codusr_usr, u.codpad_usr
          FROM dbo.usuario u
          WHERE u.codusr_usr = @objetivo

          UNION ALL

          SELECT up.codusr_usr, up.codpad_usr
          FROM dbo.usuario up
          INNER JOIN tree t ON t.codpad_usr = up.codusr_usr
        )
        SELECT TOP 1 1 AS ok
        FROM tree
        WHERE codusr_usr = @padre;
      `,
      { padre, objetivo },
    );

    return Array.isArray(rows) && rows.length > 0;
  }
}
