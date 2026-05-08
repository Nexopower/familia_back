import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import type { RequestUser } from 'src/auth/auth.types';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';
import { AuthService } from 'src/auth/auth.service';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly authService: AuthService,
  ) {}

  /**
   * GET /dashboard/overview
   * Vista general: resumen agregado por negocio.
   * Solo: admin, dueños y usuarios con loginmulti.
   */
  @Get('overview')
  @RequirePermiso('DASHBOARD.VER')
  async overview(@Request() req: RequestUser) {
    return await this.dashboardService.overview(req.user);
  }

  /**
   * GET /dashboard/resumen?codneg=123
   * Vista por negocio: métricas + alertas derivadas.
   */
  @Get('resumen')
  @RequirePermiso('DASHBOARD.VER')
  async resumen(@Query('codneg') codneg: string | undefined, @Request() req: RequestUser) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.dashboardService.resumen(codnegValue);
  }
}
