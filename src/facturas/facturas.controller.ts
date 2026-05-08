import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('facturas')
export class FacturasController {
  constructor(
    private readonly service: FacturasService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermiso('FACTURAS.VER')
  async listar(
    @Query('codneg') codneg: number | undefined,
    @Query('tipo') tipo: string | undefined,
    @Query('estado') estado: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Query('limit') limit: number | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return await this.service.listar({
      codneg: codnegValue,
      tipo: tipo ?? null,
      estado: estado ?? null,
      desde: desdeDate && !Number.isNaN(desdeDate.getTime()) ? desdeDate : null,
      hasta: hastaDate && !Number.isNaN(hastaDate.getTime()) ? hastaDate : null,
      limit: limit === undefined ? null : Number(limit),
    });
  }

  @Post()
  @RequirePermiso('FACTURAS.CREAR')
  async crear(
    @Body()
    body: { codneg?: number; tipo: string; codcli?: number; codpro?: number },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.crear({
      codneg,
      tipo: body.tipo,
      codcli: body.codcli ? Number(body.codcli) : undefined,
      codpro: body.codpro ? Number(body.codpro) : undefined,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post(':codfac/detalle')
  @RequirePermiso('FACTURAS.CREAR')
  async agregarDetalle(
    @Param('codfac') codfac: string,
    @Body() body: { codprd: number; cantidad: number; preuni: number },
    @Request() req: any,
  ) {
    const meta = await this.service.obtenerMeta(Number(codfac));
    await this.authService.assertCanAccessNegocio(req.user, meta.codneg);
    return await this.service.agregarDetalle({
      codfac: Number(codfac),
      codprd: Number(body.codprd),
      cantidad: Number(body.cantidad),
      preuni: Number(body.preuni),
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post(':codfac/cerrar')
  @RequirePermiso('FACTURAS.CERRAR')
  async cerrar(@Param('codfac') codfac: string, @Request() req: any) {
    const meta = await this.service.obtenerMeta(Number(codfac));
    await this.authService.assertCanAccessNegocio(req.user, meta.codneg);
    return await this.service.cerrar(
      Number(codfac),
      req.user?.sub ?? null,
      req.user?.audit ?? null,
    );
  }

  @Get(':codfac')
  @RequirePermiso('FACTURAS.VER')
  async obtener(
    @Param('codfac') codfac: string,
    @Request() req: any,
  ) {
    const meta = await this.service.obtenerMeta(Number(codfac));
    await this.authService.assertCanAccessNegocio(req.user, meta.codneg);
    return await this.service.obtener(Number(codfac), meta.codneg);
  }
}
