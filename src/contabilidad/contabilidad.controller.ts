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
