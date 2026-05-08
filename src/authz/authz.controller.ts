import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
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
}
