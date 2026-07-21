import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ContabilidadService } from './contabilidad.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('contabilidad')
export class ContabilidadController {
  constructor(
    private readonly service: ContabilidadService,
    private readonly authService: AuthService,
  ) {}

  @Get('cuentas')
  @RequirePermiso('CONTABILIDAD.VER')
  async listarCuentas(@Query('codneg') codneg: string | undefined, @Request() req: any) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarCuentas(codnegValue);
  }

  @Post('cuentas')
  @RequirePermiso('CONTABILIDAD.VER')
  async crearCuenta(
    @Body() body: { codneg?: number; nombre: string; tipo?: string },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.crearCuenta({
      codneg,
      nombre: body.nombre,
      tipo: body.tipo,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Get('config')
  @RequirePermiso('CONTABILIDAD.VER')
  async obtenerConfig(@Query('codneg') codneg: string | undefined, @Request() req: any) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.obtenerConfig(codnegValue);
  }

  @Post('config')
  @RequirePermiso('CONTABILIDAD.VER')
  async guardarConfig(
    @Body() body: { codneg?: number; concepto: string; codcta: number | null },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.guardarConfig({
      codneg,
      concepto: body.concepto,
      codcta: body.codcta ?? null,
      usermod: req.user?.audit ?? null,
    });
  }

  @Get('reportes/proveedores')
  @RequirePermiso('CONTABILIDAD.VER')
  async reporteProveedores(
    @Query('codneg') codneg: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    const d = desde ? new Date(desde) : null;
    const h = hasta ? new Date(hasta) : null;
    return await this.service.reporteProveedores({
      codneg: codnegValue,
      desde: d && !Number.isNaN(d.getTime()) ? d : null,
      hasta: h && !Number.isNaN(h.getTime()) ? h : null,
    });
  }

  @Get('reportes/clientes')
  @RequirePermiso('CONTABILIDAD.VER')
  async reporteClientes(
    @Query('codneg') codneg: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    const d = desde ? new Date(desde) : null;
    const h = hasta ? new Date(hasta) : null;
    return await this.service.reporteClientes({
      codneg: codnegValue,
      desde: d && !Number.isNaN(d.getTime()) ? d : null,
      hasta: h && !Number.isNaN(h.getTime()) ? h : null,
    });
  }

  @Get('reportes/desglose')
  @RequirePermiso('CONTABILIDAD.VER')
  async ventasDesglose(
    @Query('codneg') codneg: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    const d = desde ? new Date(desde) : null;
    const h = hasta ? new Date(hasta) : null;
    return await this.service.ventasDesglose({
      codneg: codnegValue,
      desde: d && !Number.isNaN(d.getTime()) ? d : null,
      hasta: h && !Number.isNaN(h.getTime()) ? h : null,
    });
  }

  @Get('caja')
  @RequirePermiso('CONTABILIDAD.VER')
  async cierreCaja(
    @Query('codneg') codneg: string | undefined,
    @Query('fecha') fecha: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    const fechaDate = fecha ? new Date(fecha) : null;
    return await this.service.cierreCaja({
      codneg: codnegValue,
      fecha: fechaDate && !Number.isNaN(fechaDate.getTime()) ? fechaDate : null,
    });
  }

  @Get('resumen')
  @RequirePermiso('CONTABILIDAD.VER')
  async resumen(
    @Query('codneg') codneg: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return await this.service.resumen({
      codneg: codnegValue,
      desde: desdeDate && !Number.isNaN(desdeDate.getTime()) ? desdeDate : null,
      hasta: hastaDate && !Number.isNaN(hastaDate.getTime()) ? hastaDate : null,
    });
  }

  @Get('ingresos')
  @RequirePermiso('CONTABILIDAD.VER')
  async listarIngresos(
    @Query('codneg') codneg: string | undefined,
    @Query('codcta') codcta: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return await this.service.listarIngresos({
      codneg: codnegValue,
      codcta: codcta === undefined ? null : Number(codcta),
      desde: desdeDate && !Number.isNaN(desdeDate.getTime()) ? desdeDate : null,
      hasta: hastaDate && !Number.isNaN(hastaDate.getTime()) ? hastaDate : null,
      limit: limit === undefined ? null : Number(limit),
    });
  }

  @Get('egresos')
  @RequirePermiso('CONTABILIDAD.VER')
  async listarEgresos(
    @Query('codneg') codneg: string | undefined,
    @Query('codcta') codcta: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return await this.service.listarEgresos({
      codneg: codnegValue,
      codcta: codcta === undefined ? null : Number(codcta),
      desde: desdeDate && !Number.isNaN(desdeDate.getTime()) ? desdeDate : null,
      hasta: hastaDate && !Number.isNaN(hastaDate.getTime()) ? hastaDate : null,
      limit: limit === undefined ? null : Number(limit),
    });
  }

  @Post('ingresos')
  @RequirePermiso('CONTABILIDAD.INGRESO.CREAR')
  async registrarIngreso(
    @Body()
    body: {
      codneg?: number;
      codcta: number;
      monto: number;
      descri?: string;
      refdoc?: string;
    },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.registrarIngreso({
      codneg,
      codcta: Number(body.codcta),
      monto: Number(body.monto),
      descri: body.descri,
      refdoc: body.refdoc,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post('egresos')
  @RequirePermiso('CONTABILIDAD.EGRESO.CREAR')
  async registrarEgreso(
    @Body()
    body: {
      codneg?: number;
      codcta: number;
      monto: number;
      descri?: string;
      refdoc?: string;
    },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.registrarEgreso({
      codneg,
      codcta: Number(body.codcta),
      monto: Number(body.monto),
      descri: body.descri,
      refdoc: body.refdoc,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }
}
