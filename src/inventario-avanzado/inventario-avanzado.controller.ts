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
import { InventarioAvanzadoService } from './inventario-avanzado.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';

/**
 * Controlador de Inventario Avanzado
 *
 * Endpoints para:
 * - Unidades de medida (catálogo global)
 * - Conversiones de unidades (por negocio)
 * - Producto-UM (unidad base por producto)
 * - Composición/Recetas (BOM)
 * - Transformaciones
 * - Detalle de producto (precio)
 * - Venta de producto
 */
@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('inventario-avanzado')
export class InventarioAvanzadoController {
  constructor(
    private readonly service: InventarioAvanzadoService,
    private readonly authService: AuthService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // UNIDADES DE MEDIDA (catálogo global)
  // ═══════════════════════════════════════════════════════════════════

  @Get('unidades')
  @RequirePermiso('INVENTARIO.VER')
  async listarUnidades(
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
  ) {
    return await this.service.listarUnidadesMedida({ tipo, estado });
  }

  @Post('unidades')
  @RequirePermiso('INVENTARIO.UNIDADES.GESTIONAR')
  async crearUnidad(
    @Body() body: { nombre: string; simbolo?: string; tipo: string },
    @Request() req: any,
  ) {
    return await this.service.crearUnidadMedida({
      nombre: body.nombre,
      simbolo: body.simbolo,
      tipo: body.tipo,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Patch('unidades/:codumd')
  @RequirePermiso('INVENTARIO.UNIDADES.GESTIONAR')
  async actualizarUnidad(
    @Param('codumd') codumd: string,
    @Body()
    body: { nombre?: string; simbolo?: string; tipo?: string; estado?: 'A' | 'I' },
    @Request() req: any,
  ) {
    return await this.service.actualizarUnidadMedida({
      codumd: Number(codumd),
      nombre: body.nombre,
      simbolo: body.simbolo,
      tipo: body.tipo,
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONVERSIONES DE UNIDADES (por negocio)
  // ═══════════════════════════════════════════════════════════════════

  @Get('conversiones')
  @RequirePermiso('INVENTARIO.VER')
  async listarConversiones(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarConversiones(codnegValue);
  }

  @Post('conversiones')
  @RequirePermiso('INVENTARIO.CONVERSIONES.GESTIONAR')
  async crearConversion(
    @Body()
    body: {
      codneg: number;
      codumd_origen: number;
      codumd_destino: number;
      factor: number;
    },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.crearConversion({
      codneg: codnegValue,
      codumd_origen: Number(body.codumd_origen),
      codumd_destino: Number(body.codumd_destino),
      factor: Number(body.factor),
      usercrea: req.user?.audit ?? null,
    });
  }

  @Patch('conversiones/:codcnv')
  @RequirePermiso('INVENTARIO.CONVERSIONES.GESTIONAR')
  async actualizarConversion(
    @Param('codcnv') codcnv: string,
    @Body() body: { codneg: number; factor?: number; estado?: 'A' | 'I' },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.actualizarConversion({
      codcnv: Number(codcnv),
      codneg: codnegValue,
      factor: body.factor,
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRODUCTO - UNIDAD DE MEDIDA (unidad base por producto)
  // ═══════════════════════════════════════════════════════════════════

  @Get('producto-um/:codprd')
  @RequirePermiso('INVENTARIO.VER')
  async obtenerProductoUM(
    @Param('codprd') codprd: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.obtenerProductoUM(codnegValue, Number(codprd));
  }

  @Post('producto-um')
  @RequirePermiso('PRODUCTOS.EDITAR')
  async setProductoUM(
    @Body()
    body: {
      codneg: number;
      codprd: number;
      codumd: number;
      factor_inventario?: number;
    },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.setProductoUM({
      codneg: codnegValue,
      codprd: Number(body.codprd),
      codumd: Number(body.codumd),
      factor_inventario: body.factor_inventario,
      usercrea: req.user?.audit ?? null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMPOSICIÓN / RECETAS (BOM)
  // ═══════════════════════════════════════════════════════════════════

  @Get('recetas')
  @RequirePermiso('PRODUCTOS.VER')
  async listarProductosConReceta(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarProductosConReceta(codnegValue);
  }

  @Get('recetas/:codprd')
  @RequirePermiso('PRODUCTOS.VER')
  async obtenerComposicion(
    @Param('codprd') codprd: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarComposicion(codnegValue, Number(codprd));
  }

  @Post('recetas')
  @RequirePermiso('PRODUCTOS.RECETAS.GESTIONAR')
  async setComposicion(
    @Body()
    body: {
      codneg: number;
      codprd_final: number;
      insumos: Array<{ codprd_insumo: number; cantidad: number }>;
    },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.setComposicion({
      codneg: codnegValue,
      codprd_final: Number(body.codprd_final),
      insumos: body.insumos || [],
      usercrea: req.user?.audit ?? null,
    });
  }

  @Delete('recetas/item/:codpco')
  @RequirePermiso('PRODUCTOS.RECETAS.GESTIONAR')
  async eliminarItemComposicion(
    @Param('codpco') codpco: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.eliminarItemComposicion({
      codneg: codnegValue,
      codpco: Number(codpco),
      usermod: req.user?.audit ?? null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // TRANSFORMACIONES
  // ═══════════════════════════════════════════════════════════════════

  @Get('transformaciones')
  @RequirePermiso('INVENTARIO.VER')
  async listarTransformaciones(
    @Query('codneg') codneg: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarTransformaciones({
      codneg: codnegValue,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('transformaciones/:codtrf')
  @RequirePermiso('INVENTARIO.VER')
  async obtenerTransformacion(
    @Param('codtrf') codtrf: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.obtenerTransformacion(codnegValue, Number(codtrf));
  }

  @Post('transformaciones')
  @RequirePermiso('INVENTARIO.TRANSFORMACIONES.GESTIONAR')
  async crearTransformacion(
    @Body()
    body: {
      codneg: number;
      detalle?: string;
      tipo?: string;
      items: Array<{
        codprd: number;
        tipo: 'entrada' | 'salida';
        cantidad: number;
        detalle?: string;
      }>;
    },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.crearTransformacion({
      codneg: codnegValue,
      detalle: body.detalle,
      tipo: body.tipo,
      items: body.items,
      codusr: req.user?.codusr ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // DETALLE PRODUCTO (precio)
  // ═══════════════════════════════════════════════════════════════════

  @Get('producto-detalle/:codprd')
  @RequirePermiso('PRODUCTOS.VER')
  async obtenerProductoDetalle(
    @Param('codprd') codprd: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.obtenerProductoDetalle(codnegValue, Number(codprd));
  }

  @Post('producto-detalle')
  @RequirePermiso('PRODUCTOS.EDITAR')
  async setProductoDetalle(
    @Body()
    body: {
      codneg: number;
      codprd: number;
      precio_venta?: number | null;
      precio_compra?: number | null;
    },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.setProductoDetalle({
      codneg: codnegValue,
      codprd: Number(body.codprd),
      precio_venta: body.precio_venta,
      precio_compra: body.precio_compra,
      usercrea: req.user?.audit ?? null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // VENTA DE PRODUCTO (aplica receta si existe)
  // ═══════════════════════════════════════════════════════════════════

  @Post('venta')
  @RequirePermiso('INVENTARIO.MOVIMIENTO.CREAR')
  async ventaProducto(
    @Body() body: { codneg: number; codprd: number; cantidad: number },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.ventaProducto({
      codneg: codnegValue,
      codprd: Number(body.codprd),
      cantidad: Number(body.cantidad),
      codusr: req.user?.codusr ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // EMPAQUE: configuración de jerarquía (caja→paquete→unidad)
  // ═══════════════════════════════════════════════════════════════════

  @Post('empaques/propagar-precios')
  @RequirePermiso('PRODUCTOS.EDITAR')
  async propagarPreciosEmpaque(
    @Body() body: { codneg: number },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.propagarPreciosEmpaque(codnegValue);
  }

  @Get('empaques/jerarquia')
  @RequirePermiso('INVENTARIO.VER')
  async listarJerarquiaEmpaques(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarJerarquiaEmpaques(codnegValue);
  }

  @Get('empaques/:codprd')
  @RequirePermiso('PRODUCTOS.VER')
  async getEmpaqueConfig(
    @Param('codprd') codprd: string,
    @Query('codneg') codneg: number,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.getEmpaqueConfig(codnegValue, Number(codprd));
  }

  @Post('empaques')
  @RequirePermiso('PRODUCTOS.RECETAS.GESTIONAR')
  async setEmpaqueConfig(
    @Body() body: { codneg: number; codprd_empaque: number; codprd_contenido: number; cantidad: number },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.setEmpaqueConfig({
      codneg: codnegValue,
      codprd_empaque: Number(body.codprd_empaque),
      codprd_contenido: Number(body.codprd_contenido),
      cantidad: Number(body.cantidad),
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post('empaques/destapar')
  @RequirePermiso('INVENTARIO.MOVIMIENTO.CREAR')
  async destaparEmpaque(
    @Body() body: { codneg: number; codprd_empaque: number; cantidad: number },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.destaparEmpaque({
      codneg: codnegValue,
      codprd_empaque: Number(body.codprd_empaque),
      cantidad: Number(body.cantidad),
      codusr: req.user?.codusr ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post('empaques/ensamblar')
  @RequirePermiso('INVENTARIO.MOVIMIENTO.CREAR')
  async ensamblarCompuesto(
    @Body() body: { codneg: number; codprd_final: number; cantidad: number },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.ensamblarCompuesto({
      codneg: codnegValue,
      codprd_final: Number(body.codprd_final),
      cantidad: Number(body.cantidad),
      codusr: req.user?.codusr ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // VISTA CONSOLIDADA: Productos con stock, precio y unidad
  // ═══════════════════════════════════════════════════════════════════

  @Get('productos-detallados')
  @RequirePermiso('PRODUCTOS.VER')
  async listarProductosConDetalles(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarProductosConDetalles(codnegValue);
  }
}
