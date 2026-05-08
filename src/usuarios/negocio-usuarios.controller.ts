import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';
import type { RequestUser } from 'src/auth/auth.types';
import { NegocioUsuariosService } from './negocio-usuarios.service';
import { SqlService } from 'src/sql/sql.service';
import { AuthService } from 'src/auth/auth.service';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('negocios/:codneg/usuarios')
export class NegocioUsuariosController {
  constructor(
    private readonly service: NegocioUsuariosService,
    private readonly sql: SqlService,
    private readonly authService: AuthService,
  ) {}

  @Get('roles')
  async listarRoles(
    @Param('codneg') codneg: string,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    const rows = await this.sql.executeQuery(
      `SELECT codrol_rol AS codrol, nombre_rol AS nombre FROM dbo.roles ORDER BY nombre_rol`,
    );
    return rows ?? [];
  }

  @Get('descendientes')
  @RequirePermiso('USUARIOS.VER')
  async descendientes(
    @Param('codneg') codneg: string,
    @Request() req: RequestUser,
  ) {
    return await this.service.listarDescendientes(req.user, Number(codneg));
  }

  @Post()
  @RequirePermiso('USUARIOS.CREAR')
  async crear(
    @Param('codneg') codneg: string,
    @Body()
    body: {
      codusr: string;
      nombre: string;
      password: string;
      codrol: number;
      codper?: number;
    },
    @Request() req: RequestUser,
  ) {
    return await this.service.crearConRol(req.user, Number(codneg), body);
  }

  @Patch(':codusr/rol')
  @RequirePermiso('USUARIOS.ROL.CAMBIAR')
  async cambiarRol(
    @Param('codneg') codneg: string,
    @Param('codusr') codusr: string,
    @Body() body: { codrol: number },
    @Request() req: RequestUser,
  ) {
    return await this.service.cambiarRolNegocio(
      req.user,
      Number(codneg),
      codusr,
      Number(body.codrol),
    );
  }

  @Patch(':codusr/estado')
  @RequirePermiso('USUARIOS.ESTADO.CAMBIAR')
  async cambiarEstado(
    @Param('codneg') codneg: string,
    @Param('codusr') codusr: string,
    @Body() body: { estado: 'A' | 'I' },
    @Request() req: RequestUser,
  ) {
    return await this.service.setEstadoUsuarioEnNegocio(
      req.user,
      Number(codneg),
      codusr,
      body.estado,
    );
  }

  @Put(':codusr/roles-creables')
  @RequirePermiso('USUARIOS.ROLES_CREABLES.CONFIGURAR')
  async rolesCreables(
    @Param('codneg') codneg: string,
    @Param('codusr') codusr: string,
    @Body() body: { roles: Array<{ codrol: number; permitido: boolean }> },
    @Request() req: RequestUser,
  ) {
    return await this.service.setRolesCreables(
      req.user,
      Number(codneg),
      codusr,
      body?.roles ?? [],
    );
  }
}
