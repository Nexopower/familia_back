import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('inventario')
export class InventarioController {
  constructor(
    private readonly service: InventarioService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermiso('INVENTARIO.VER')
  async listar(
    @Query('codneg') codneg: number,
    @Query('q') q: string | undefined,
    @Query('codprd') codprd: number | undefined,
    @Request() req: any,
  ) {
    await this.authService.assertCanAccessNegocio(req.user, Number(codneg));
    return await this.service.listarStock({
      codneg: Number(codneg),
      codprd: codprd === undefined ? null : Number(codprd),
      q: q ?? null,
    });
  }

  @Get('movimientos')
  @RequirePermiso('INVENTARIO.MOVIMIENTO.VER')
  async listarMovimientos(
    @Query('codneg') codneg: number,
    @Query('codprd') codprd: number | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Query('limit') limit: number | undefined,
    @Request() req: any,
  ) {
    await this.authService.assertCanAccessNegocio(req.user, Number(codneg));

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return await this.service.listarMovimientos({
      codneg: Number(codneg),
      codprd: codprd === undefined ? null : Number(codprd),
      desde: desdeDate && !Number.isNaN(desdeDate.getTime()) ? desdeDate : null,
      hasta: hastaDate && !Number.isNaN(hastaDate.getTime()) ? hastaDate : null,
      limit: limit === undefined ? null : Number(limit),
    });
  }

  @Get('stock')
  @RequirePermiso('INVENTARIO.VER')
  async stock(
    @Query('codneg') codneg: number,
    @Query('codprd') codprd: number,
    @Request() req: any,
  ) {
    await this.authService.assertCanAccessNegocio(req.user, Number(codneg));
    return await this.service.stock(Number(codneg), Number(codprd));
  }

  @Post('movimientos')
  @RequirePermiso('INVENTARIO.MOVIMIENTO.CREAR')
  async movimiento(
    @Body()
    body: {
      codneg: number;
      codprd: number;
      tipo: string;
      cantidad: number;
      detalle?: string;
    },
    @Request() req: any,
  ) {
    await this.authService.assertCanAccessNegocio(
      req.user,
      Number(body.codneg),
    );
    return await this.service.movimiento({
      codneg: Number(body.codneg),
      codprd: Number(body.codprd),
      tipo: body.tipo,
      cantidad: Number(body.cantidad),
      detalle: body.detalle,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }
}
