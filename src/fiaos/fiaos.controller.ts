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
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';
import { AuthService } from 'src/auth/auth.service';
import { FiaosService } from './fiaos.service';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('fiaos')
export class FiaosController {
  constructor(
    private readonly service: FiaosService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermiso('FACTURAS.VER')
  async listar(
    @Query('codneg') codneg: string | undefined,
    @Query('estado') estado: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listar({ codneg: codnegValue, estado: estado ?? null });
  }

  @Get('saldos')
  @RequirePermiso('FACTURAS.VER')
  async saldos(@Query('codneg') codneg: string | undefined, @Request() req: any) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.saldosPorCliente(codnegValue);
  }

  @Get(':codfia')
  @RequirePermiso('FACTURAS.VER')
  async obtener(
    @Param('codfia') codfia: string,
    @Query('codneg') codneg: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.obtener(Number(codfia), codnegValue);
  }

  // Cobrar un abono (dinero real → registra ingreso contable).
  @Post(':codfia/abonos')
  @RequirePermiso('FACTURAS.CREAR')
  async abonar(
    @Param('codfia') codfia: string,
    @Body() body: { codneg?: number; monto: number; nota?: string },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.abonar({
      codfia: Number(codfia),
      codneg: codnegValue,
      monto: Number(body.monto),
      nota: body.nota ?? null,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }
}
