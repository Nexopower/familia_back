import {
  Body,
  Controller,
  Get,
  Post,
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

  // Alias: GET /rbac/permisos — devuelve lista plana de permisos del catálogo
  @Get('permisos')
  async permisos() {
    const cat = await this.service.catalog();
    // Retorna array plano de permisos con su módulo
    return (cat as any)?.moduloPermisos
      ? Object.entries((cat as any).moduloPermisos).flatMap(([mod, perms]: [string, any]) =>
          (perms as string[]).map((clave: string, i: number) => ({
            codprm: i + 1,
            clave,
            nombre: clave,
            modulo: mod,
          })),
        )
      : [];
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
