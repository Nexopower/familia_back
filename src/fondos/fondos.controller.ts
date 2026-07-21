import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';
import { AuthService } from 'src/auth/auth.service';
import { FondosService } from './fondos.service';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('fondos')
export class FondosController {
  constructor(
    private readonly service: FondosService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermiso('FONDOS.VER')
  async listar(@Query('codneg') codneg: string | undefined, @Request() req: any) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listar(codnegValue);
  }

  // Estado del fondo de un cliente (lo usa la caja al facturar).
  @Get('saldo')
  @RequirePermiso('FACTURAS.VER')
  async saldo(
    @Query('codneg') codneg: string | undefined,
    @Query('codcli') codcli: string,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.saldoCliente(codnegValue, Number(codcli));
  }

  @Get(':codfon/historial')
  @RequirePermiso('FONDOS.VER')
  async historial(
    @Param('codfon') codfon: string,
    @Query('codneg') codneg: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.historial(Number(codfon), codnegValue);
  }

  @Post()
  @RequirePermiso('FONDOS.CONFIGURAR')
  async crear(
    @Body() body: { codneg?: number; codcli: number; montoDiario: number; diasSemana: number },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.crear({
      codneg: codnegValue,
      codcli: Number(body.codcli),
      montoDiario: Number(body.montoDiario),
      diasSemana: Number(body.diasSemana),
      usercrea: req.user?.audit ?? null,
    });
  }

  @Patch(':codfon')
  @RequirePermiso('FONDOS.CONFIGURAR')
  async actualizar(
    @Param('codfon') codfon: string,
    @Body() body: { codneg?: number; montoDiario?: number; diasSemana?: number; estado?: 'A' | 'I' },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.actualizar({
      codfon: Number(codfon),
      codneg: codnegValue,
      montoDiario: body.montoDiario === undefined ? undefined : Number(body.montoDiario),
      diasSemana: body.diasSemana === undefined ? undefined : Number(body.diasSemana),
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }

  // Recarga manual del saldo (movimiento tipo 'ajuste').
  @Post(':codfon/recargar')
  @RequirePermiso('FONDOS.CONFIGURAR')
  async recargar(
    @Param('codfon') codfon: string,
    @Body() body: { codneg?: number; monto: number; nota?: string },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.recargar({
      codfon: Number(codfon),
      codneg: codnegValue,
      monto: Number(body.monto),
      nota: body.nota ?? null,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post(':codfon/transferir')
  @RequirePermiso('FONDOS.TRANSFERIR')
  async transferir(
    @Param('codfon') codfon: string,
    @Body() body: { codneg?: number; codnegDestino: number; monto: number; nota?: string },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    // El destino también debe ser accesible para quien autoriza.
    await this.authService.assertCanAccessNegocio(req.user, Number(body.codnegDestino));
    return await this.service.transferir({
      codfonOrigen: Number(codfon),
      codneg: codnegValue,
      codnegDestino: Number(body.codnegDestino),
      monto: Number(body.monto),
      nota: body.nota ?? null,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }
}
