import { Body, Controller, Post, Request, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { RequestUser } from 'src/auth/auth.types';
import { AuthService } from 'src/auth/auth.service';
import { AuthzService } from './authz.service';

@UseGuards(JwtAuthGuard)
@Controller('authz')
export class AuthzController {
  constructor(
    private readonly authz: AuthzService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Checkea permisos puntuales para habilitar/ocultar acciones en frontend.
   * Body: { codneg?: number|null, permisos: string[] }
   */
  @Post('check')
  async check(
    @Body() body: { codneg?: number | null; permisos: string[] },
    @Request() req: RequestUser,
  ) {
    const payload = req.user;
    const codusr = String(payload?.sub ?? '').trim();
    if (!codusr) return { ok: false, permisos: {} as Record<string, boolean> };

    const rawCodneg = body?.codneg;
    const codneg =
      rawCodneg === undefined || rawCodneg === null
        ? (payload?.codneg ?? null)
        : Number(rawCodneg);

    // Si se solicita con codneg, validar acceso (admin bypass)
    if (codneg !== null) {
      await this.authService.assertCanAccessNegocio(payload, Number(codneg));
    }

    const list = Array.isArray(body?.permisos) ? body.permisos : [];
    const result: Record<string, boolean> = {};

    for (const p of list) {
      const clave = String(p ?? '').trim();
      if (!clave) continue;
      result[clave] = await this.authz.tienePermiso(codusr, codneg, clave);
    }

    return { ok: true, codneg, permisos: result };
  }

  @Post('authorize')
  async authorize(
    @Body() body: { codusr: string; password: string; permiso: string; codneg?: number },
    @Request() req: RequestUser,
  ) {
    const codusr = String(body?.codusr ?? '').trim();
    const password = String(body?.password ?? '').trim();
    const permiso = String(body?.permiso ?? '').trim();
    if (!codusr || !password || !permiso) throw new BadRequestException('codusr, password y permiso son requeridos');

    try {
      const loginRes = await this.authService.login({ codusr, password, codneg: body?.codneg });
      const auditId = loginRes?.user?.codper ?? null;
      const codneg = body?.codneg ?? req.user?.codneg ?? null;
      const ok = await this.authz.tienePermiso(codusr, codneg, permiso);
      if (!ok) throw new ForbiddenException('No autorizado');
      return { ok: true, codusr, auditId };
    } catch (e) {
      throw new ForbiddenException('Credenciales inválidas o sin permiso');
    }
  }
}
