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

    // SP recomendado (si existe en tu BD)
    try {
      return await this.sql.executeQueryParams(
        `EXEC dbo.sp_usuario_descendientes_listar @actor_codusr=@actor_codusr, @codneg=@codneg;`,
        { actor_codusr: actor, codneg: codnegValue },
      );
    } catch {
      // Fallback: lista descendientes por jerarquía (codpad_usr) filtrando por negocio
      const rows = await this.sql.executeQueryParams(
        `
          WITH tree AS (
            SELECT u.codusr_usr, u.codpad_usr, 0 AS nivel
            FROM dbo.usuario u
            WHERE u.codusr_usr = @actor

            UNION ALL

            SELECT u.codusr_usr, u.codpad_usr, t.nivel + 1
            FROM dbo.usuario u
            INNER JOIN tree t ON u.codpad_usr = t.codusr_usr
          )
          SELECT
            u.codusr_usr AS codusr,
            u.nombre_usr AS nombre,
            u.estado_usr AS estado_usr,
            u.codpad_usr AS codpad,
            t.nivel AS nivel,
            un.codrol_uneg AS codrol_negocio,
            un.estado_uneg AS estado_uneg
          FROM tree t
          INNER JOIN dbo.usuario u ON u.codusr_usr = t.codusr_usr
          LEFT JOIN dbo.usuario_negocio un
            ON un.codusr_uneg = u.codusr_usr
           AND un.codneg_uneg = @codneg
          WHERE t.nivel > 0
          ORDER BY t.nivel, u.codusr_usr;
        `,
        { actor, codneg: codnegValue },
      );

      return rows;
    }
  }

  async crearConRol(
    payload: JwtPayload | undefined,
    codneg: number,
    input: {
      codusr: string;
      nombre: string;
      password: string;
      codrol: number;
      codper?: number;
    },
  ) {
    const actor = this.actorCodusr(payload);
    const codnegValue = Number(codneg);
    const codrolValue = Number(input?.codrol);

    if (!Number.isFinite(codnegValue) || !codnegValue) {
      throw new BadRequestException('codneg es requerido');
    }
    if (!Number.isFinite(codrolValue) || !codrolValue) {
      throw new BadRequestException('codrol es requerido');
    }

    const codusrNuevo = String(input?.codusr ?? '').trim();
    const nombre = String(input?.nombre ?? '').trim();
    const password = String(input?.password ?? '');

    if (!codusrNuevo) throw new BadRequestException('codusr es requerido');
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

    // SP recomendado (si existe en tu BD). Debe aplicar plantilla y validar roles creables.
    return await this.sql.executeQueryParams(
      `
        EXEC dbo.sp_usuario_crear_con_rol
          @actor_codusr=@actor_codusr,
          @codneg=@codneg,
          @codusr_nuevo=@codusr_nuevo,
          @nombre=@nombre,
          @password_hash=@password_hash,
          @codper=@codper,
          @codrol=@codrol;
      `,
      {
        actor_codusr: actor,
        codneg: codnegValue,
        codusr_nuevo: codusrNuevo,
        nombre,
        password_hash: passwordHash,
        codper: input?.codper ?? null,
        codrol: codrolValue,
      },
    );
  }

  async cambiarRolNegocio(
    payload: JwtPayload | undefined,
    codneg: number,
    codusrObjetivo: string,
    codrolNuevo: number,
  ) {
    const actor = this.actorCodusr(payload);
    const codnegValue = Number(codneg);
    const codrolValue = Number(codrolNuevo);

    if (!Number.isFinite(codnegValue) || !codnegValue) {
      throw new BadRequestException('codneg es requerido');
    }
    if (!Number.isFinite(codrolValue) || !codrolValue) {
      throw new BadRequestException('codrolNuevo es requerido');
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
