import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTHZ_PERMISO_KEY } from './permiso.decorator';
import { AuthzService } from './authz.service';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class PermisoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthzService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permiso = this.reflector.getAllAndOverride<string>(
      AUTHZ_PERMISO_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no se especifica permiso, no bloquea.
    if (!permiso) return true;

    const request = context.switchToHttp().getRequest();
    const payload = request?.user;

    const codusr = String(payload?.sub ?? '').trim();
    if (!codusr) throw new UnauthorizedException('Token inválido');

    const codnegValue = payload?.codneg;
    const codneg =
      codnegValue === undefined || codnegValue === null || codnegValue === ''
        ? null
        : Number(codnegValue);

    // SUPERADMIN bypass
    const isSuperAdmin = await this.authService.isSuperAdmin(codusr);
    if (isSuperAdmin) return true;

    // Dueños: acceso total a sus negocios. En sesión sin negocio (vista
    // general de dueños/multi-negocio) se permite pasar y cada endpoint
    // valida su propio alcance.
    if (codneg !== null) {
      if (await this.authz.esDuenoDeNegocio(codusr, codneg)) return true;
    } else {
      const flags = await this.authService.getUserFlags(codusr);
      if (flags?.esdueno || flags?.loginmulti) return true;
    }

    const ok = await this.authz.tienePermiso(codusr, codneg, permiso);
    // 403 (no 401): el usuario está autenticado pero no autorizado.
    // Un 401 haría que el frontend descarte la sesión completa.
    if (!ok) throw new ForbiddenException('Permiso denegado');

    return true;
  }
}
