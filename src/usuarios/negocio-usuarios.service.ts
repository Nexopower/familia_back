import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SqlService } from 'src/sql/sql.service';
import { AuthService } from 'src/auth/auth.service';
import { AuthzService } from 'src/authz/authz.service';
import { EncryptionService } from 'src/encryption/encryption.service';
import type { JwtPayload } from 'src/auth/auth.types';

@Injectable()
export class NegocioUsuariosService {
  constructor(
    private readonly sql: SqlService,
    private readonly authService: AuthService,
    private readonly authz: AuthzService,
    private readonly encryption: EncryptionService,
  ) {}

  private async spExists(spName: string): Promise<boolean> {
    const rows = await this.sql.executeQueryParams(
      `SELECT OBJECT_ID(@name, 'P') AS id;`,
      { name: spName },
    );
    return Boolean(rows?.[0]?.id);
  }

  private actorCodusr(payload: JwtPayload | undefined) {
    const codusr = String(payload?.sub ?? '').trim();
    if (!codusr) throw new ForbiddenException('Token inválido');
    return codusr;
  }

  async listarDescendientes(payload: JwtPayload | undefined, codneg: number) {
    const actor = this.actorCodusr(payload);
    const codnegValue = Number(codneg);
    if (!Number.isFinite(codnegValue) || !codnegValue) {
      throw new BadRequestException('codneg es requerido');
    }

    // Validar acceso al negocio (admin bypass)
    await this.authService.assertCanAccessNegocio(payload, codnegValue);

    const esSuperAdmin = await this.authService.isSuperAdmin(actor);

    // Columnas comunes (nombres que espera el frontend).
    const cols = `
      u.codusr_usr       AS codusr,
      u.nombre_usr       AS nombre_usr,
      ISNULL(un.estado_uneg, 'A') AS estado,
      u.estado_usr       AS estado_usr,
      per.nombre_per     AS persona_nombre,
      per.apellidos_per  AS persona_apellido,
      r.nombre_rol       AS rol_nombre,
      un.codrol_uneg     AS codrol,
      u.esdueno_usr      AS esdueno,
      u.loginmulti_usr   AS loginmulti,
      CAST(CASE WHEN nd.codusr_ndu IS NULL THEN 0 ELSE 1 END AS bit) AS esdueno_negocio
    `;

    // SUPERADMIN / dueño con acceso: ve TODOS los usuarios del negocio,
    // incluidos los dueños aunque no tengan vínculo en usuario_negocio.
    if (esSuperAdmin) {
      return await this.sql.executeQueryParams(
        `
          SELECT ${cols}
          FROM (
            SELECT codusr_uneg AS codusr FROM dbo.usuario_negocio WHERE codneg_uneg = @codneg
            UNION
            SELECT codusr_ndu FROM dbo.negocio_dueno WHERE codneg_ndu = @codneg AND ISNULL(estado_ndu, 'A') = 'A'
          ) m
          INNER JOIN dbo.usuario u ON u.codusr_usr = m.codusr
          LEFT JOIN dbo.usuario_negocio un
            ON un.codusr_uneg = u.codusr_usr AND un.codneg_uneg = @codneg
          LEFT JOIN dbo.negocio_dueno nd
            ON nd.codusr_ndu = u.codusr_usr AND nd.codneg_ndu = @codneg AND ISNULL(nd.estado_ndu, 'A') = 'A'
          LEFT JOIN dbo.personas per ON per.codper_per = u.codper_usr
          LEFT JOIN dbo.roles r ON r.codrol_rol = un.codrol_uneg
          ORDER BY u.codusr_usr;
        `,
        { codneg: codnegValue },
      );
    }

    // Resto: solo sus descendientes (jerarquía codpad_usr) dentro del negocio.
    return await this.sql.executeQueryParams(
      `
        WITH tree AS (
          SELECT u.codusr_usr FROM dbo.usuario u WHERE u.codusr_usr = @actor
          UNION ALL
          SELECT u.codusr_usr
          FROM dbo.usuario u
          INNER JOIN tree t ON u.codpad_usr = t.codusr_usr
        )
        SELECT ${cols}
        FROM tree t
        INNER JOIN dbo.usuario u ON u.codusr_usr = t.codusr_usr
        INNER JOIN dbo.usuario_negocio un
          ON un.codusr_uneg = u.codusr_usr AND un.codneg_uneg = @codneg
        LEFT JOIN dbo.negocio_dueno nd
          ON nd.codusr_ndu = u.codusr_usr AND nd.codneg_ndu = @codneg AND ISNULL(nd.estado_ndu, 'A') = 'A'
        LEFT JOIN dbo.personas per ON per.codper_per = u.codper_usr
        LEFT JOIN dbo.roles r ON r.codrol_rol = un.codrol_uneg
        WHERE t.codusr_usr <> @actor
        ORDER BY u.codusr_usr;
      `,
      { actor, codneg: codnegValue },
    );
  }

  /**
   * Busca usuarios existentes para asignarlos al negocio (aún no vinculados).
   * SUPERADMIN busca en todos; el resto solo entre sus descendientes.
   */
  async buscarAsignables(
    payload: JwtPayload | undefined,
    codneg: number,
    q: string,
  ) {
    const actor = this.actorCodusr(payload);
    const codnegValue = Number(codneg);
    if (!Number.isFinite(codnegValue) || !codnegValue) {
      throw new BadRequestException('codneg es requerido');
    }
    const term = String(q ?? '').trim();
    if (term.length < 2) {
      throw new BadRequestException('q debe tener al menos 2 caracteres');
    }

    await this.authService.assertCanAccessNegocio(payload, codnegValue);
    const esSuperAdmin = await this.authService.isSuperAdmin(actor);

    // No superadmin: solo puede asignar usuarios de su propio árbol (descendientes).
    const filtroDescendientes = esSuperAdmin
      ? ''
      : 'AND u.codusr_usr IN (SELECT codusr_usr FROM tree WHERE codusr_usr <> @actor)';

    return await this.sql.executeQueryParams(
      `
        WITH tree AS (
          SELECT u0.codusr_usr FROM dbo.usuario u0 WHERE u0.codusr_usr = @actor
          UNION ALL
          SELECT u1.codusr_usr
          FROM dbo.usuario u1
          INNER JOIN tree t ON u1.codpad_usr = t.codusr_usr
        )
        SELECT TOP 20
          u.codusr_usr      AS codusr,
          u.nombre_usr      AS nombre_usr,
          per.nombre_per    AS persona_nombre,
          per.apellidos_per AS persona_apellido
        FROM dbo.usuario u
        LEFT JOIN dbo.personas per ON per.codper_per = u.codper_usr
        WHERE u.estado_usr = 'A'
          AND NOT EXISTS (
            SELECT 1 FROM dbo.usuario_negocio un
            WHERE un.codusr_uneg = u.codusr_usr AND un.codneg_uneg = @codneg
          )
          ${filtroDescendientes}
          AND (
            u.codusr_usr LIKE @q
            OR u.nombre_usr LIKE @q
            OR ISNULL(per.nombre_per, '') LIKE @q
            OR ISNULL(per.apellidos_per, '') LIKE @q
          )
        ORDER BY u.codusr_usr;
      `,
      { codneg: codnegValue, actor, q: `%${term}%` },
    );
  }

  async crearConRol(
    payload: JwtPayload | undefined,
    codneg: number,
    input: {
      /** Opcional: si no viene, el código se genera automáticamente (LLLNNNNN). */
      codusr?: string;
      nombre: string;
      password: string;
      codrol: number;
      codper?: number;
      esdueno?: boolean;
      loginmulti?: boolean;
      /** Negocios adicionales a los que tendrá acceso (login multi-negocio). */
      codnegs?: number[];
    },
  ) {
    const actor = this.actorCodusr(payload);
    const codnegValue = Number(codneg);
    const codrolValue = Number(input?.codrol);
    const codrolFinal =
      Number.isFinite(codrolValue) && codrolValue > 0 ? codrolValue : null;

    if (!Number.isFinite(codnegValue) || !codnegValue) {
      throw new BadRequestException('codneg es requerido');
    }

    // El código de usuario ya NO se digita: lo genera el SP salvo que venga explícito.
    const codusrNuevo = String(input?.codusr ?? '').trim() || null;
    const nombre = String(input?.nombre ?? '').trim();
    const password = String(input?.password ?? '');

    if (!nombre) throw new BadRequestException('nombre es requerido');
    if (!password) throw new BadRequestException('password es requerido');

    // Validar acceso al negocio (admin bypass)
    await this.authService.assertCanAccessNegocio(payload, codnegValue);

    const passwordHash = await this.encryption.hashPassword(password);

    const spName = 'dbo.sp_usuario_crear_con_rol';
    const hasSp = await this.spExists(spName);
    if (!hasSp) {
      throw new NotFoundException(
        `No existe el SP requerido: ${spName}. Implementa el contrato RBAC avanzado en BD o ajusta este endpoint.`,
      );
    }

    // SP recomendado (si existe en tu BD). Genera el código si @codusr_nuevo es NULL.
    const rows = await this.sql.executeQueryParams(
      `
        EXEC dbo.sp_usuario_crear_con_rol
          @actor_codusr=@actor_codusr,
          @codneg=@codneg,
          @codusr_nuevo=@codusr_nuevo,
          @nombre=@nombre,
          @password_hash=@password_hash,
          @codper=@codper,
          @codrol=@codrol,
          @esdueno=@esdueno,
          @loginmulti=@loginmulti;
      `,
      {
        actor_codusr: actor,
        codneg: codnegValue,
        codusr_nuevo: codusrNuevo,
        nombre,
        password_hash: passwordHash,
        codper: input?.codper ?? null,
        codrol: codrolFinal,
        esdueno: input?.esdueno ? 1 : 0,
        loginmulti: input?.loginmulti ? 1 : 0,
      },
    );

    const creado = rows?.[0] ?? null;
    const codusrCreado = String(creado?.codusr ?? '').trim();

    // Vincular negocios adicionales (login multi-negocio) reutilizando el SP de rol.
    const extras = Array.from(
      new Set(
        (input?.codnegs ?? [])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0 && n !== codnegValue),
      ),
    );
    if (codusrCreado && extras.length) {
      for (const neg of extras) {
        await this.authService.assertCanAccessNegocio(payload, neg);
        await this.sql.executeQueryParams(
          `EXEC dbo.sp_usuario_negocio_rol_set @actor_codusr=@actor_codusr, @codneg=@codneg, @codusr_objetivo=@codusr_objetivo, @codrol_nuevo=@codrol_nuevo;`,
          {
            actor_codusr: actor,
            codneg: neg,
            codusr_objetivo: codusrCreado,
            codrol_nuevo: codrolFinal,
          },
        );
      }
    }

    return creado;
  }

  async cambiarRolNegocio(
    payload: JwtPayload | undefined,
    codneg: number,
    codusrObjetivo: string,
    codrolNuevo: number | null,
  ) {
    const actor = this.actorCodusr(payload);
    const codnegValue = Number(codneg);
    // Rol opcional: NULL = vincular al negocio sin rol.
    const codrolValue =
      codrolNuevo == null || !Number.isFinite(Number(codrolNuevo)) || Number(codrolNuevo) <= 0
        ? null
        : Number(codrolNuevo);

    if (!Number.isFinite(codnegValue) || !codnegValue) {
      throw new BadRequestException('codneg es requerido');
    }

    const objetivo = String(codusrObjetivo ?? '').trim();
    if (!objetivo) throw new BadRequestException('codusr objetivo es requerido');

    // Validar acceso al negocio (admin bypass)
    await this.authService.assertCanAccessNegocio(payload, codnegValue);

    const spName = 'dbo.sp_usuario_negocio_rol_set';
    const hasSp = await this.spExists(spName);
    if (!hasSp) {
      throw new NotFoundException(
        `No existe el SP requerido: ${spName}. Implementa el contrato RBAC avanzado en BD o ajusta este endpoint.`,
      );
    }

    // SP recomendado (valida descendencia + roles creables)
    return await this.sql.executeQueryParams(
      `EXEC dbo.sp_usuario_negocio_rol_set @actor_codusr=@actor_codusr, @codneg=@codneg, @codusr_objetivo=@codusr_objetivo, @codrol_nuevo=@codrol_nuevo;`,
      {
        actor_codusr: actor,
        codneg: codnegValue,
        codusr_objetivo: objetivo,
        codrol_nuevo: codrolValue,
      },
    );
  }

  async setEstadoUsuarioEnNegocio(
    payload: JwtPayload | undefined,
    codneg: number,
    codusrObjetivo: string,
    estado: 'A' | 'I',
  ) {
    const actor = this.actorCodusr(payload);
    const codnegValue = Number(codneg);

    if (!Number.isFinite(codnegValue) || !codnegValue) {
      throw new BadRequestException('codneg es requerido');
    }

    const objetivo = String(codusrObjetivo ?? '').trim();
    if (!objetivo) throw new BadRequestException('codusr objetivo es requerido');

    // Validar acceso al negocio (admin bypass)
    await this.authService.assertCanAccessNegocio(payload, codnegValue);

    const esSuperAdmin = await this.authService.isSuperAdmin(actor);
    if (!esSuperAdmin) {
      const ok = await this.authz.esDescendiente(actor, objetivo);
      if (!ok) {
        throw new ForbiddenException('Solo puede administrar descendientes');
      }
    }

    const targetEstado = estado === 'A' ? 'A' : 'I';

    const rows = await this.sql.executeQueryParams(
      `
        UPDATE dbo.usuario_negocio
          SET estado_uneg = @estado,
              usermod = @usermod,
              fechmod = GETDATE()
        OUTPUT inserted.codusr_uneg AS codusr, inserted.codneg_uneg AS codneg, inserted.estado_uneg AS estado
        WHERE codusr_uneg = @codusr AND codneg_uneg = @codneg;
      `,
      {
        codusr: objetivo,
        codneg: codnegValue,
        estado: targetEstado,
        usermod: payload?.audit ?? null,
      },
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new NotFoundException('Relación usuario-negocio no encontrada');
    }

    return rows[0];
  }

  async setRolesCreables(
    payload: JwtPayload | undefined,
    codneg: number,
    codusrTarget: string,
    items: Array<{ codrol: number; permitido: boolean }>,
  ) {
    const actor = this.actorCodusr(payload);
    const codnegValue = Number(codneg);

    if (!Number.isFinite(codnegValue) || !codnegValue) {
      throw new BadRequestException('codneg es requerido');
    }

    const target = String(codusrTarget ?? '').trim();
    if (!target) throw new BadRequestException('codusr target es requerido');

    await this.authService.assertCanAccessNegocio(payload, codnegValue);

    if (!Array.isArray(items)) {
      throw new BadRequestException('items inválidos');
    }

    const spName = 'dbo.sp_usuario_negocio_rol_creable_set';
    const hasSp = await this.spExists(spName);
    if (!hasSp) {
      throw new NotFoundException(
        `No existe el SP requerido: ${spName}. Implementa el contrato RBAC avanzado en BD o ajusta este endpoint.`,
      );
    }

    // Lote: ejecuta el SP por cada rol
    for (const it of items) {
      const codrol = Number(it?.codrol);
      if (!Number.isFinite(codrol) || !codrol) continue;

      await this.sql.executeQueryParams(
        `EXEC dbo.sp_usuario_negocio_rol_creable_set @actor_codusr=@actor_codusr, @codneg=@codneg, @codusr_target=@codusr_target, @codrol=@codrol, @permitido=@permitido;`,
        {
          actor_codusr: actor,
          codneg: codnegValue,
          codusr_target: target,
          codrol,
          permitido: it?.permitido ? 1 : 0,
        },
      );
    }

    return { ok: true };
  }
}
