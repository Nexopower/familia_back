import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { RequestUser } from 'src/auth/auth.types';
import { RbacService } from './rbac.service';

@UseGuards(JwtAuthGuard)
@Controller('rbac')
export class RbacController {
  constructor(private readonly service: RbacService) {}

  // Catálogo para que el frontend sepa qué módulos/permisos existen
  @Get('catalog')
  async catalog() {
    return await this.service.catalog();
  }

  // GET /rbac/permisos — lista plana de permisos REALES de la BD (con su módulo)
  @Get('permisos')
  async permisos() {
    return await this.service.listarPermisos();
  }

  // Módulos visibles según negocio + permisos
  @Get('visible-modules')
  async visibleModules(
    @Query('codneg') codneg: string | undefined,
    @Request() req: RequestUser,
  ) {
    return await this.service.visibleModules(req.user, codneg);
  }

  // --- Administración RBAC (solo SUPERADMIN) ---

  @Get('roles')
  async roles(@Request() req: RequestUser) {
    return await this.service.listarRoles(req.user);
  }

  @Post('roles')
  async rolCrear(
    @Body() body: { nombre: string; detalle?: string | null; codnegs?: number[] },
    @Request() req: RequestUser,
  ) {
    return await this.service.rolCrear(req.user, body);
  }

  @Get('roles/:codrol/permisos')
  async rolPermisos(
    @Param('codrol') codrol: string,
    @Request() req: RequestUser,
  ) {
    return await this.service.rolPermisos(req.user, Number(codrol));
  }

  @Post('permisos/upsert')
  async permisoUpsert(
    @Body() body: { clave: string; nombre: string; detalle?: string },
    @Request() req: RequestUser,
  ) {
    return await this.service.permisoUpsert(req.user, body);
  }

  @Post('permisos/sync')
  async permisosSync(@Request() req: RequestUser) {
    return await this.service.permisosSync(req.user);
  }

  // Alias: POST /rbac/sync-manifest — mismo que permisos/sync
  @Post('sync-manifest')
  async syncManifest(@Request() req: RequestUser) {
    return await this.service.permisosSync(req.user);
  }

  @Post('roles/permisos/set')
  async rolPermisoSet(
    @Body() body: { codrol: number; clavePermiso: string; estado?: 'A' | 'I' },
    @Request() req: RequestUser,
  ) {
    return await this.service.rolPermisoSet(req.user, body);
  }

  @Post('usuarios/rol-global/set')
  async usuarioRolGlobalSet(
    @Body() body: { codusr: string; codrol: number; estado?: 'A' | 'I' },
    @Request() req: RequestUser,
  ) {
    return await this.service.usuarioRolGlobalSet(req.user, body);
  }
}
