import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from 'src/token/token.service';
import { SqlService } from 'src/sql/sql.service';
import { EncryptionService } from 'src/encryption/encryption.service';
import { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly token: TokenService,
    private readonly sql: SqlService,
    private readonly encryption: EncryptionService,
  ) {}

  private async getEncryptedPassword(password: string): Promise<string> {
    return await this.encryption.hashPassword(password);
  }

  private async listNegociosForUser(codusr: string) {
    const query = `
            SELECT
                n.codneg_neg AS codneg,
                n.nombre_neg,
                CAST(CASE WHEN nd.codusr_ndu IS NULL THEN 0 ELSE 1 END AS bit) AS esdueno,
                CAST(ISNULL(nd.esprincipal_ndu, 0) AS bit) AS esprincipal,
                un.codrol_uneg AS codrol,
                r.nombre_rol AS nombre_rol
            FROM dbo.negocios n
            LEFT JOIN dbo.negocio_dueno nd
                ON nd.codneg_ndu = n.codneg_neg
                AND nd.codusr_ndu = @codusr
                AND nd.estado_ndu = 'A'
            LEFT JOIN dbo.usuario_negocio un
                ON un.codneg_uneg = n.codneg_neg
                AND un.codusr_uneg = @codusr
                AND un.estado_uneg = 'A'
            LEFT JOIN dbo.roles r
                ON r.codrol_rol = un.codrol_uneg
            WHERE n.estado_neg = 'A'
              AND (nd.codusr_ndu IS NOT NULL OR un.codusr_uneg IS NOT NULL)
            ORDER BY n.nombre_neg;
        `;

    return await this.sql.executeQueryParams(query, { codusr });
  }

  private async userHasNegocio(
    codusr: string,
    codneg: number,
  ): Promise<boolean> {
    const query = `
            SELECT TOP 1 1 AS ok
            FROM dbo.usuario_negocio un
            WHERE un.codusr_uneg = @codusr
              AND un.codneg_uneg = @codneg
              AND un.estado_uneg = 'A'
            UNION ALL
            SELECT TOP 1 1 AS ok
            FROM dbo.negocio_dueno nd
            WHERE nd.codusr_ndu = @codusr
              AND nd.codneg_ndu = @codneg
              AND nd.estado_ndu = 'A';
        `;

    const rows = await this.sql.executeQueryParams(query, { codusr, codneg });
    return Array.isArray(rows) && rows.length > 0;
  }

  async assertCanAccessNegocio(
    payload: { sub?: string } | undefined,
    codneg: number,
  ) {
    const targetCodneg = Number(codneg);
    if (!Number.isFinite(targetCodneg)) {
      throw new BadRequestException('codneg es requerido');
    }

    const codusr = String(payload?.sub ?? '');
    if (!codusr) {
      throw new UnauthorizedException('Token inválido');
    }

    const esSuperAdmin = await this.isSuperAdmin(codusr);
    if (esSuperAdmin) return;

    const ok = await this.userHasNegocio(codusr, targetCodneg);
    if (!ok) {
      throw new UnauthorizedException('Usuario no pertenece al negocio');
    }
  }

  private async getRolForNegocio(
    codusr: string,
    codneg: number,
  ): Promise<number | null> {
    const query = `
            SELECT TOP 1 codrol_uneg
            FROM dbo.usuario_negocio
            WHERE codusr_uneg = @codusr
              AND codneg_uneg = @codneg
              AND estado_uneg = 'A';
        `;

    const rows = await this.sql.executeQueryParams(query, { codusr, codneg });
    const value = rows?.[0]?.codrol_uneg;
    const n = value === null || value === undefined ? null : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  async isSuperAdmin(codusr: string): Promise<boolean> {
    if (!codusr) return false;

    // Atajo por semilla del script
    if (String(codusr).toLowerCase() === 'admin') return true;

    const query = `
      SELECT TOP 1 1 AS ok
      FROM dbo.usuario_rol_global urg
      INNER JOIN dbo.roles r ON r.codrol_rol = urg.codrol_urg
      WHERE urg.codusr_urg = @codusr
        AND r.nombre_rol = N'SUPERADMIN';
    `;

    const rows = await this.sql.executeQueryParams(query, { codusr });
    return Array.isArray(rows) && rows.length > 0;
  }

  private async listAllNegocios() {
    const query = `
      SELECT n.codneg_neg AS codneg, n.nombre_neg
      FROM dbo.negocios n
      WHERE n.estado_neg = 'A'
      ORDER BY n.nombre_neg;
    `;
    return await this.sql.executeQuery(query);
  }

  async listNegociosForLogin() {
    const rows = await this.listAllNegocios();
    return (rows || []).map((n: any) => ({
      codneg: Number(n.codneg),
      nombre: String(n.nombre_neg ?? ''),
    }));
  }

  async listNegociosForUserContext(payload: { sub?: string } | undefined) {
    const codusr = String(payload?.sub ?? '').trim();
    if (!codusr) throw new UnauthorizedException('Token inválido');

    const esSuperAdmin = await this.isSuperAdmin(codusr);
    const rows = esSuperAdmin
      ? await this.listAllNegocios()
      : await this.listNegociosForUser(codusr);

    return (rows || []).map((n: any) => ({
      codneg: Number(n.codneg),
      nombre: String(n.nombre_neg ?? ''),
      esdueno: Boolean(n.esdueno),
      esprincipal: Boolean(n.esprincipal),
      codrol: n.codrol != null ? Number(n.codrol) : null,
      nombre_rol: n.nombre_rol ? String(n.nombre_rol) : null,
    }));
  }

  async getUserFlags(
    codusr: string,
  ): Promise<{ esdueno: boolean; loginmulti: boolean }> {
    const query = `
      SELECT TOP 1 esdueno_usr, loginmulti_usr
      FROM dbo.usuario
      WHERE codusr_usr = @codusr;
    `;
    const rows = await this.sql.executeQueryParams(query, { codusr });
    const row = rows?.[0];
    return {
      esdueno: Boolean(row?.esdueno_usr),
      loginmulti: Boolean(row?.loginmulti_usr),
    };
  }

  /**
   * Login: valida credenciales y (si aplica) selecciona negocio para generar JWT.
   *
   * Modelo BD nuevo:
   * - Credencial: nombre_usr + passwo_usr
   * - Relación a negocio: usuario_negocio / negocio_dueno
   *
   * Compatibilidad:
   * - Si viene codusr, valida contra usuario.codusr_usr.
   */
  async login(input: {
    password: string;
    codusr?: string;
    nombre?: string;
    codneg?: number;
  }) {
    const password = input?.password;
    if (!password) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const codneg =
      input.codneg !== undefined && input.codneg !== null
        ? Number(input.codneg)
        : undefined;
    const encryptedPassword = await this.getEncryptedPassword(password);

    // 1) Identificar usuario
    let userRows: any[] = [];

    if (input.codusr) {
      userRows = await this.sql.executeQueryParams(
        `
                    SELECT codusr_usr, codper_usr, codrol_usr, nombre_usr, passwo_usr, estado_usr, esdueno_usr, loginmulti_usr
                    FROM dbo.usuario
                    WHERE codusr_usr = @codusr;
                `,
        { codusr: input.codusr },
      );
    } else if (input.nombre) {
      // Buscar por nombre + password (hash determinístico). También permitimos password en texto plano
      // para compatibilidad con semillas (ej: admin) si todavía no está cifrado.
      userRows = await this.sql.executeQueryParams(
        `
                    SELECT codusr_usr, codper_usr, codrol_usr, nombre_usr, passwo_usr, estado_usr, esdueno_usr, loginmulti_usr
                    FROM dbo.usuario
                    WHERE nombre_usr = @nombre
                      AND estado_usr = 'A'
                      AND (passwo_usr = @passEnc OR passwo_usr = @passPlain);
                `,
        {
          nombre: input.nombre,
          passEnc: encryptedPassword,
          passPlain: password,
        },
      );
    } else {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    if (!userRows || userRows.length === 0) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    // Si viene nombre y devolvió varios (nombre no único), exigir codneg o codusr para desambiguar.
    if (!input.codusr && input.nombre && userRows.length > 1 && !codneg) {
      throw new UnauthorizedException(
        'Debe seleccionar un negocio (codneg) o iniciar con codusr',
      );
    }

    // Si hay varios, intentar filtrar por codneg.
    let user = userRows[0];
    if (userRows.length > 1 && codneg) {
      for (const candidate of userRows) {
        const ok = await this.userHasNegocio(candidate.codusr_usr, codneg);
        if (ok) {
          user = candidate;
          break;
        }
      }
    }

    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    if (user.estado_usr !== 'A') {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Para el caso codusr: validar password (hash o texto plano por compatibilidad)
    if (input.codusr) {
      const validEncrypted = await this.encryption.comparePassword(
        password,
        user.passwo_usr,
      );
      const validPlain = user.passwo_usr === password;
      if (!validEncrypted && !validPlain) {
        throw new UnauthorizedException('Usuario o contraseña incorrectos');
      }
    }

    // 2) Tipo de login
    const codusr = String(user.codusr_usr);
    const esSuperAdmin = await this.isSuperAdmin(codusr);
    const esDueno = Boolean(user.esdueno_usr);
    const loginmulti = Boolean(user.loginmulti_usr);

    // 3) Resolver negocios accesibles
    const negociosRows = esSuperAdmin
      ? await this.listAllNegocios()
      : await this.listNegociosForUser(codusr);

    const negocios = Array.isArray(negociosRows)
      ? negociosRows.map((n: any) => ({
          codneg: Number(n.codneg),
          nombre: n.nombre_neg,
          esdueno: Boolean(n.esdueno),
          esprincipal: Boolean(n.esprincipal),
        }))
      : [];

    // 4) Regla: usuarios normales deben seleccionar negocio en login.
    const mustSelectNegocioOnLogin = !esSuperAdmin && !esDueno && !loginmulti;
    if (mustSelectNegocioOnLogin && codneg === undefined) {
      throw new UnauthorizedException(
        'Debe seleccionar un negocio para iniciar sesión con este usuario',
      );
    }

    // 5) Resolver negocio seleccionado (puede ser null si sesión multi)
    let selectedCodneg: number | null = null;

    if (codneg !== undefined) {
      const ok = esSuperAdmin
        ? true
        : await this.userHasNegocio(codusr, Number(codneg));
      if (!ok) {
        throw new UnauthorizedException('Usuario no pertenece al negocio');
      }
      selectedCodneg = Number(codneg);
    } else {
      // Sesión sin negocio (vista general) para admin/dueños/loginmulti
      if (!esSuperAdmin) {
        if (!negocios || negocios.length === 0) {
          throw new UnauthorizedException(
            'Usuario no tiene negocios asignados',
          );
        }
        // Si solo hay uno, auto-seleccionamos para simplificar
        if (negocios.length === 1) {
          selectedCodneg = Number(negocios[0].codneg);
        }
      }
    }

    // 6) Resolver rol (por negocio si existe) y generar tokens
    const rolNegocio =
      selectedCodneg !== null
        ? await this.getRolForNegocio(codusr, Number(selectedCodneg))
        : null;
    const codrol = rolNegocio ?? user.codrol_usr ?? null;

    const { accessToken, refreshToken } = await this.token.GenerateTokenPair(
      {
        codusr: user.codusr_usr,
        codrol,
        codneg: selectedCodneg === null ? undefined : Number(selectedCodneg),
        auditId: user.codper_usr || null,
      },
      false,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        codusr: user.codusr_usr,
        codper: user.codper_usr ?? null,
        codrol,
        codneg: selectedCodneg,
        nombre: user.nombre_usr,
        esdueno: esDueno,
        loginmulti,
        isAdmin: esSuperAdmin,
      },
      // Para admin: lista total. Para dueños y loginmulti: lista de sus negocios.
      // Para trabajadores que seleccionan negocio en login: no es estrictamente necesario,
      // pero lo dejamos para que el frontend pueda mostrar el selector si corresponde.
      negocios: esSuperAdmin || esDueno || loginmulti ? negocios : undefined,
    };
  }

  async switchNegocio(
    payload: {
      sub: string;
      codrol?: number | string | null;
      audit?: number | null;
      codneg?: number | null;
    },
    codneg: number,
  ) {
    const codusr = String(payload?.sub);
    const targetCodneg = Number(codneg);
    if (!codusr || !Number.isFinite(targetCodneg)) {
      throw new UnauthorizedException('Negocio inválido');
    }

    const esSuperAdmin = await this.isSuperAdmin(codusr);
    if (!esSuperAdmin) {
      const flags = await this.getUserFlags(codusr);
      const canSwitch = flags.esdueno || flags.loginmulti;
      if (!canSwitch) {
        throw new UnauthorizedException(
          'Este usuario no puede cambiar de negocio sin volver a iniciar sesión',
        );
      }
    }
    const ok = esSuperAdmin
      ? true
      : await this.userHasNegocio(codusr, targetCodneg);
    if (!ok) {
      throw new UnauthorizedException('Usuario no pertenece al negocio');
    }

    const rolNegocio = await this.getRolForNegocio(codusr, targetCodneg);
    const codrol = rolNegocio ?? payload.codrol ?? null;

    const accessToken = await this.token.GenerateToken(
      {
        codusr,
        codrol: codrol ?? undefined,
        codneg: targetCodneg,
        auditId: this.toAuditIdSafe(payload.audit),
      },
      900,
    );

    return {
      accessToken,
      expiresIn: 900,
      codneg: targetCodneg,
      codrol,
    };
  }

  private toAuditIdSafe(value: unknown): number | undefined {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  async validatedToken(request: Request) {
    const token: string | undefined =
      this.token.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }
    const payload = await this.token.ValidatedToken(token);
    return payload;
  }

  async refreshAccessToken(input: { refreshToken?: string }) {
    const refreshToken = String(input?.refreshToken ?? '').trim();
    if (!refreshToken) {
      throw new UnauthorizedException('refreshToken es requerido');
    }

    return await this.token.RefreshAccessToken(refreshToken);
  }

  async logout(request: Request) {
    const raw = this.token.extractTokenFromHeader(request);
    return await this.token.revokeToken(raw);
  }
}
