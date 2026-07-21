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
import { ReservasService } from './reservas.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('reservas')
export class ReservasController {
  constructor(
    private readonly service: ReservasService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @RequirePermiso('RESERVAS.CREAR')
  async crear(
    @Body()
    body: {
      codneg?: number;
      codcli: number;
      fecini: string;
      fecfin: string;
      detalle?: string;
    },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.crear({
      codneg,
      codcli: Number(body.codcli),
      fecini: new Date(body.fecini),
      fecfin: new Date(body.fecfin),
      detalle: body.detalle,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post(':codres/reprogramar')
  @RequirePermiso('RESERVAS.REPROGRAMAR')
  async reprogramar(
    @Param('codres') codres: string,
    @Body() body: { fecini: string; fecfin: string },
    @Request() req: any,
  ) {
    return await this.service.reprogramar({
      codres: Number(codres),
      fecini: new Date(body.fecini),
      fecfin: new Date(body.fecfin),
      usercrea: req.user?.audit ?? null,
    });
  }

  @Put(':codres')
  @RequirePermiso('RESERVAS.REPROGRAMAR')
  async editar(
    @Param('codres') codres: string,
    @Body() body: { codcli: number; fecini: string; fecfin: string; detalle?: string },
    @Request() req: any,
  ) {
    const codneg = await this.service.codnegDeReserva(Number(codres));
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.editar({
      codres: Number(codres),
      codcli: Number(body.codcli),
      fecini: new Date(body.fecini),
      fecfin: new Date(body.fecfin),
      detalle: body.detalle ?? null,
      usermod: req.user?.audit ?? null,
    });
  }

  @Patch(':codres/estado')
  @RequirePermiso('RESERVAS.REPROGRAMAR')
  async cambiarEstado(
    @Param('codres') codres: string,
    @Body() body: { estado: string },
    @Request() req: any,
  ) {
    const codneg = await this.service.codnegDeReserva(Number(codres));
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.cambiarEstado({
      codres: Number(codres),
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }

  @Get()
  @RequirePermiso('RESERVAS.VER')
  async listar(
    @Query('codneg') codneg: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Request() req?: any,
  ) {
    const codnegValue = Number(codneg ?? req?.user?.codneg);
    await this.authService.assertCanAccessNegocio(req?.user, codnegValue);
    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;
    return await this.service.listar(codnegValue, desdeDate, hastaDate);
  }

  @Get(':codres')
  @RequirePermiso('RESERVAS.VER')
  async obtener(
    @Param('codres') codres: string,
    @Query('codneg') codneg?: number,
    @Request() req?: any,
  ) {
    const codnegValue = Number(codneg ?? req?.user?.codneg);
    if (Number.isFinite(codnegValue) && codnegValue) {
      await this.authService.assertCanAccessNegocio(req?.user, codnegValue);
    }
    return await this.service.obtener(Number(codres), codnegValue || undefined);
  }
}
