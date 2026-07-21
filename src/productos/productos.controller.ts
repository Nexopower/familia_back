import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('productos')
export class ProductosController {
  constructor(
    private readonly service: ProductosService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermiso('PRODUCTOS.VER')
  async listar(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listar(codnegValue);
  }

  @Get('buscar')
  @RequirePermiso('PRODUCTOS.VER')
  async buscar(
    @Query('codneg') codneg: number,
    @Query('q') q: string,
    @Request() req: any,
  ) {
    const codnegValue = codneg !== undefined && codneg !== null ? Number(codneg) : Number(req.user?.codneg ?? 0);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.buscar(codnegValue, String(q ?? '').trim());
  }

  @Post()
  @RequirePermiso('PRODUCTOS.CREAR')
  async crear(
    @Body()
    body: {
      codneg: number;
      nombre: string;
      codigo?: string;
      codcat?: number;
      codmar?: number;
      stockmin?: number | null;
      tipo_prd?: 'simple' | 'compuesto' | 'empaque';
    },
    @Request() req: any,
  ) {
    await this.authService.assertCanAccessNegocio(
      req.user,
      Number(body.codneg),
    );
    return await this.service.crear({
      codneg: Number(body.codneg),
      nombre: body.nombre,
      codigo: body.codigo,
      codcat: body.codcat ? Number(body.codcat) : undefined,
      codmar: body.codmar ? Number(body.codmar) : undefined,
      stockmin: body.stockmin !== undefined ? (body.stockmin === null ? null : Number(body.stockmin)) : undefined,
      tipo_prd: body.tipo_prd,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Patch(':codprd')
  @RequirePermiso('PRODUCTOS.EDITAR')
  async actualizar(
    @Param('codprd') codprd: string,
    @Body()
    body: {
      codneg: number;
      nombre?: string;
      codigo?: string | null;
      codcat?: number | null;
      codmar?: number | null;
      stockmin?: number | null;
      tipo_prd?: 'simple' | 'compuesto' | 'empaque';
      estado?: 'A' | 'I';
    },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);

    return await this.service.actualizar({
      codneg: codnegValue,
      codprd: Number(codprd),
      nombre: body.nombre,
      codigo: body.codigo,
      codcat: body.codcat as any,
      codmar: body.codmar as any,
      stockmin: body.stockmin as any,
      tipo_prd: body.tipo_prd,
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }

  @Delete(':codprd')
  @RequirePermiso('PRODUCTOS.ELIMINAR')
  async inactivar(
    @Param('codprd') codprd: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.inactivar({
      codneg: codnegValue,
      codprd: Number(codprd),
      usermod: req.user?.audit ?? null,
    });
  }

  // --- Unidades de medida ---

  @Get('unidades-medida')
  @RequirePermiso('PRODUCTOS.VER')
  async unidadesMedida(@Request() req: any) {
    return await this.service.listarUnidadesMedida();
  }

  @Post('producto-um')
  @RequirePermiso('PRODUCTOS.EDITAR')
  async setProductoUm(
    @Body() body: { codneg: number; codprd: number; codumd: number | null },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.setProductoUm({
      codneg: codnegValue,
      codprd: Number(body.codprd),
      codumd: body.codumd === null ? null : Number(body.codumd),
      usercrea: req.user?.audit ?? null,
    });
  }

  // --- Categorías (mismo módulo Productos) ---

  @Get('categorias')
  @RequirePermiso('PRODUCTOS.VER')
  async categorias(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarCategorias(codnegValue);
  }

  @Post('categorias')
  @RequirePermiso('PRODUCTOS.CATEGORIAS.GESTIONAR')
  async categoriaCrear(
    @Body() body: { codneg: number; nombre: string },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.crearCategoria({
      codneg: codnegValue,
      nombre: body.nombre,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Patch('categorias/:codcat')
  @RequirePermiso('PRODUCTOS.CATEGORIAS.GESTIONAR')
  async categoriaActualizar(
    @Param('codcat') codcat: string,
    @Body() body: { codneg: number; nombre?: string; estado?: 'A' | 'I' },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.actualizarCategoria({
      codneg: codnegValue,
      codcat: Number(codcat),
      nombre: body.nombre,
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }

  @Delete('categorias/:codcat')
  @RequirePermiso('PRODUCTOS.CATEGORIAS.GESTIONAR')
  async categoriaInactivar(
    @Param('codcat') codcat: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.inactivarCategoria({
      codneg: codnegValue,
      codcat: Number(codcat),
      usermod: req.user?.audit ?? null,
    });
  }

  // --- Marcas (mismo módulo Productos) ---

  @Get('marcas')
  @RequirePermiso('PRODUCTOS.VER')
  async marcas(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarMarcas(codnegValue);
  }

  @Post('marcas')
  @RequirePermiso('PRODUCTOS.MARCAS.GESTIONAR')
  async marcaCrear(
    @Body() body: { codneg: number; nombre: string },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.crearMarca({
      codneg: codnegValue,
      nombre: body.nombre,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Patch('marcas/:codmar')
  @RequirePermiso('PRODUCTOS.MARCAS.GESTIONAR')
  async marcaActualizar(
    @Param('codmar') codmar: string,
    @Body() body: { codneg: number; nombre?: string; estado?: 'A' | 'I' },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.actualizarMarca({
      codneg: codnegValue,
      codmar: Number(codmar),
      nombre: body.nombre,
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }

  @Delete('marcas/:codmar')
  @RequirePermiso('PRODUCTOS.MARCAS.GESTIONAR')
  async marcaInactivar(
    @Param('codmar') codmar: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.inactivarMarca({
      codneg: codnegValue,
      codmar: Number(codmar),
      usermod: req.user?.audit ?? null,
    });
  }
}
