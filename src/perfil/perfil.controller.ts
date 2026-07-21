import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SqlService } from 'src/sql/sql.service';

/**
 * GET /perfil[?codneg=N]
 * Datos del usuario autenticado: login, persona vinculada y NOMBRE del rol.
 * Con codneg devuelve el rol de ese negocio; sin negocio, el rol global.
 */
@UseGuards(JwtAuthGuard)
@Controller('perfil')
export class PerfilController {
  constructor(private readonly sql: SqlService) {}

  @Get()
  async perfil(@Query('codneg') codneg: string | undefined, @Request() req: any) {
    const codusr = String(req.user?.sub ?? '').trim();
    const codnegValue = Number(codneg);
    const conNegocio = Number.isFinite(codnegValue) && codnegValue > 0;

    const rows = await this.sql.executeQueryParams(
      `
        SELECT
          u.codusr_usr      AS codusr,
          u.nombre_usr      AS login,
          u.estado_usr      AS estado,
          u.esdueno_usr     AS esdueno,
          u.loginmulti_usr  AS loginmulti,
          p.nombre_per      AS nombre,
          p.apellidos_per   AS apellido,
          p.email_per       AS email,
          p.telper_per      AS telefono,
          COALESCE(rn.nombre_rol, rg.nombre_rol) AS rol
        FROM dbo.usuario u
        LEFT JOIN dbo.personas p ON p.codper_per = u.codper_usr
        LEFT JOIN dbo.usuario_negocio un
          ON @conNegocio = 1 AND un.codusr_uneg = u.codusr_usr AND un.codneg_uneg = @codneg
        LEFT JOIN dbo.roles rn ON rn.codrol_rol = un.codrol_uneg
        LEFT JOIN dbo.roles rg ON rg.codrol_rol = u.codrol_usr
        WHERE u.codusr_usr = @codusr;
      `,
      {
        codusr,
        codneg: conNegocio ? codnegValue : null,
        conNegocio: conNegocio ? 1 : 0,
      },
    );

    const r = rows?.[0] ?? {};
    return {
      codusr: r.codusr ?? codusr,
      login: r.login ?? null,
      nombre: r.nombre ?? r.login ?? null,
      apellido: r.apellido ?? null,
      email: r.email ?? null,
      telefono: r.telefono ?? null,
      rol: r.rol ?? (codusr === 'admin' ? 'SUPERADMIN' : null),
      estado: r.estado ?? null,
      esdueno: Boolean(r.esdueno),
      loginmulti: Boolean(r.loginmulti),
    };
  }
}
