import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CajaService } from './caja.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('caja')
export class CajaController {
  constructor(
    private readonly service: CajaService,
    private readonly authService: AuthService,
  ) {}

  @Get('config')
  @RequirePermiso('CONTABILIDAD.VER')
  async getConfig(@Query('codneg') codneg: string | undefined, @Request() req: any) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.getConfig(codnegValue);
  }

  @Put('config')
  @RequirePermiso('CONTABILIDAD.VER')
  async saveConfig(
    @Body()
    body: {
      codneg?: number;
      fondoBilletes: number;
      monedasModo: 'todas' | 'fijo';
      monedasFijo?: number | null;
      impresoraIp?: string | null;
      impresoraPuerto?: number | null;
      impresoraModo?: 'red' | 'usb' | null;
      impresoraUsb?: string | null;
    },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.saveConfig({
      codneg,
      fondoBilletes: Number(body.fondoBilletes),
      monedasModo: body.monedasModo === 'fijo' ? 'fijo' : 'todas',
      monedasFijo: body.monedasFijo == null ? null : Number(body.monedasFijo),
      impresoraIp: body.impresoraIp ?? null,
      impresoraPuerto: body.impresoraPuerto == null ? null : Number(body.impresoraPuerto),
      impresoraModo: body.impresoraModo ?? null,
      impresoraUsb: body.impresoraUsb ?? null,
      usermod: req.user?.audit ?? null,
    });
  }

  @Get('estado')
  @RequirePermiso('CONTABILIDAD.VER')
  async estado(@Query('codneg') codneg: string | undefined, @Request() req: any) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.estado(codnegValue);
  }

  @Get('historial')
  @RequirePermiso('CONTABILIDAD.VER')
  async historial(
    @Query('codneg') codneg: string | undefined,
    @Query('tipo') tipo: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;
    return await this.service.historial({
      codneg: codnegValue,
      tipo: tipo ?? null,
      desde: desdeDate && !Number.isNaN(desdeDate.getTime()) ? desdeDate : null,
      hasta: hastaDate && !Number.isNaN(hastaDate.getTime()) ? hastaDate : null,
      limit: limit === undefined ? null : Number(limit),
    });
  }

  @Post('registrar')
  @RequirePermiso('CONTABILIDAD.VER')
  async registrar(
    @Body()
    body: {
      codneg?: number;
      tipo: 'apertura' | 'cierre' | 'conteo_parcial';
      turno?: string | null;
      cantidades: Record<number, number>;
      monedasModo?: 'todas' | 'fijo';
      monedasFijo?: number | null;
      notas?: string | null;
    },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.registrar({
      codneg,
      tipo: body.tipo,
      turno: body.turno ?? null,
      cantidades: body.cantidades ?? {},
      monedasModo: body.monedasModo,
      monedasFijo: body.monedasFijo == null ? null : Number(body.monedasFijo),
      notas: body.notas ?? null,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Get(':codcaj')
  @RequirePermiso('CONTABILIDAD.VER')
  async obtener(@Param('codcaj') codcaj: string, @Request() req: any) {
    const codneg = await this.service.codnegDeRegistro(Number(codcaj));
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.obtener(Number(codcaj), codneg);
  }
}
