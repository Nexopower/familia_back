import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Patch,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';
import { AuthService } from 'src/auth/auth.service';
import type { RequestUser } from 'src/auth/auth.types';
import { ConfiguracionesService } from './configuraciones.service';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('configuraciones')
export class ConfiguracionesController {
  constructor(
    private readonly service: ConfiguracionesService,
    private readonly authService: AuthService,
  ) {}

  private async assertSuperAdmin(req: RequestUser) {
    const codusr = String(req.user?.sub ?? '').trim();
    if (!codusr) throw new ForbiddenException('Token inválido');
    const ok = await this.authService.isSuperAdmin(codusr);
    if (!ok) throw new ForbiddenException('Solo SUPERADMIN');
    return codusr;
  }

  @Get('stock-minimo-default')
  @RequirePermiso('CONFIGURACIONES.VER')
  async getStockMinimoDefault(
    @Query('codneg') codneg: string | undefined,
    @Request() req: RequestUser,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.obtenerStockMinimoDefaultNegocio(codnegValue);
  }

  /**
   * GET /configuraciones/negocio?codneg=...
   * Devuelve info del negocio para el panel de configuración.
   */
  @Get('negocio')
  @RequirePermiso('CONFIGURACIONES.VER')
  async getNegocio(
    @Query('codneg') codneg: string | undefined,
    @Request() req: RequestUser,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.obtenerNegocioConfig(codnegValue);
  }

  /**
   * PUT /configuraciones/negocio
   * Actualiza nombre, dirección y stock_min_default del negocio.
   */
  @Put('negocio')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async updateNegocio(
    @Body()
    body: {
      codneg?: number;
      nombre?: string;
      direccion?: string;
      stock_min_default?: number | null;
    },
    @Request() req: RequestUser,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.actualizarNegocioConfig({
      codneg: codnegValue,
      nombre: body.nombre,
      direccion: body.direccion,
      stock_min_default: body.stock_min_default,
      usermod: (req.user as any)?.audit ?? null,
    });
  }

  @Patch('stock-minimo-default')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async setStockMinimoDefault(
    @Body()
    body: { codneg?: number; stockmin_default?: number | null },
    @Request() req: RequestUser,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);

    return await this.service.actualizarStockMinimoDefaultNegocio({
      codneg: codnegValue,
      stockmin_default:
        body.stockmin_default === undefined ? null : body.stockmin_default,
      usermod: (req.user as any)?.audit ?? null,
    });
  }

  // --- Administración de negocios (solo SUPERADMIN) ---

  @Get('negocios')
  @RequirePermiso('CONFIGURACIONES.VER')
  async listarNegocios(@Request() req: RequestUser) {
    await this.assertSuperAdmin(req);
    return await this.service.listarNegociosAdmin();
  }

  @Get('negocios/meta')
  @RequirePermiso('CONFIGURACIONES.VER')
  async metaNegocios(@Request() req: RequestUser) {
    await this.assertSuperAdmin(req);
    return await this.service.obtenerMetaNegocios();
  }

  @Get('catalogos/tipos-negocio')
  @RequirePermiso('CONFIGURACIONES.VER')
  async catalogoTiposNegocio(
    @Query('q') q: string | undefined,
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.buscarTiposNegocio(q);
  }

  @Get('catalogos/configuracion-negocio')
  @RequirePermiso('CONFIGURACIONES.VER')
  async catalogoConfiguracionNegocio(
    @Query('q') q: string | undefined,
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.buscarConfiguracionNegocio(q);
  }

  @Post('negocios')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async crearNegocio(
    @Body()
    body: {
      nombre: string;
      codtng?: number | null;
      codcfn?: number | null;
      telefono?: string;
      direccion?: string;
      stock_min_default?: number | null;
      estado?: 'A' | 'I';
    },
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.crearNegocioAdmin({
      nombre: body?.nombre,
      codtng: body?.codtng,
      codcfn: body?.codcfn,
      telefono: body?.telefono,
      direccion: body?.direccion,
      stock_min_default: body?.stock_min_default,
      estado: body?.estado,
      audit: (req.user as any)?.audit ?? null,
    });
  }

  @Patch('negocios/:codneg')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async actualizarNegocio(
    @Param('codneg') codneg: string,
    @Body()
    body: {
      nombre?: string;
      codtng?: number | null;
      codcfn?: number | null;
      telefono?: string;
      direccion?: string;
      stock_min_default?: number | null;
      estado?: 'A' | 'I';
    },
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.actualizarNegocioAdmin({
      codneg: Number(codneg),
      nombre: body?.nombre,
      codtng: body?.codtng,
      codcfn: body?.codcfn,
      telefono: body?.telefono,
      direccion: body?.direccion,
      stock_min_default: body?.stock_min_default,
      estado: body?.estado,
      audit: (req.user as any)?.audit ?? null,
    });
  }

  @Get('usuarios-duenos')
  @RequirePermiso('CONFIGURACIONES.VER')
  async buscarUsuariosDuenos(
    @Query('q') q: string,
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.buscarUsuariosDueno(q);
  }

  @Get('negocios/:codneg/duenos')
  @RequirePermiso('CONFIGURACIONES.VER')
  async listarDuenosNegocio(
    @Param('codneg') codneg: string,
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.listarDuenosNegocio(Number(codneg));
  }

  @Post('negocios/:codneg/duenos')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async asignarDuenoNegocio(
    @Param('codneg') codneg: string,
    @Body() body: { codusr?: string; esprincipal?: boolean },
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.asignarDuenoNegocio({
      codneg: Number(codneg),
      codusr: String(body?.codusr ?? ''),
      esprincipal: body?.esprincipal === true,
      audit: (req.user as any)?.audit ?? null,
    });
  }

  @Delete('negocios/:codneg/duenos/:codusr')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async quitarDuenoNegocio(
    @Param('codneg') codneg: string,
    @Param('codusr') codusr: string,
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.quitarDuenoNegocio({
      codneg: Number(codneg),
      codusr,
      audit: (req.user as any)?.audit ?? null,
    });
  }

  @Delete('negocios/:codneg')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async inactivarNegocio(
    @Param('codneg') codneg: string,
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.inactivarNegocio({
      codneg: Number(codneg),
      audit: (req.user as any)?.audit ?? null,
    });
  }

  @Patch('negocios/:codneg/reactivar')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async reactivarNegocio(
    @Param('codneg') codneg: string,
    @Request() req: RequestUser,
  ) {
    await this.assertSuperAdmin(req);
    return await this.service.reactivarNegocio({
      codneg: Number(codneg),
      audit: (req.user as any)?.audit ?? null,
    });
  }

  // Alias legacy para clientes que enviaban /configuraciones/negocio-admin
  @Post('negocio-admin')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async crearNegocioLegacy(
    @Body()
    body: {
      nombre: string;
      direccion?: string;
      stock_min_default?: number | null;
      estado?: 'A' | 'I';
    },
    @Request() req: RequestUser,
  ) {
    return await this.crearNegocio(body, req);
  }

  @Patch('negocio-admin/:codneg')
  @RequirePermiso('CONFIGURACIONES.EDITAR')
  async actualizarNegocioLegacy(
    @Param('codneg') codneg: string,
    @Body()
    body: {
      nombre?: string;
      direccion?: string;
      stock_min_default?: number | null;
      estado?: 'A' | 'I';
    },
    @Request() req: RequestUser,
  ) {
    return await this.actualizarNegocio(codneg, body, req);
  }
}
