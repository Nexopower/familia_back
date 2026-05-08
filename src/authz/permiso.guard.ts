import {
  CanActivate,
  ExecutionContext,
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

    const ok = await this.authz.tienePermiso(codusr, codneg, permiso);
    if (!ok) throw new UnauthorizedException('Permiso denegado');

    return true;
  }
}
