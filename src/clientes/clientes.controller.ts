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
import { ClientesService } from './clientes.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly service: ClientesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async listar(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listar(codnegValue);
  }

  // Gestión: incluye inactivos.
  @Get('todos')
  async listarTodos(@Query('codneg') codneg: number, @Request() req: any) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.listarTodos(codnegValue);
  }

  @Get('buscar')
  async buscar(
    @Query('codneg') codneg: number,
    @Query('q') q: string,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.buscar(codnegValue, q);
  }

  @Patch(':codcli/estado')
  async setEstado(
    @Param('codcli') codcli: string,
    @Body() body: { codneg?: number; estado: 'A' | 'I' },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.setEstado({
      codcli: Number(codcli),
      codneg: codnegValue,
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }

  // Configuración de fiao del cliente (permitir + límite máximo de deuda).
  @Patch(':codcli/fiado')
  async setFiado(
    @Param('codcli') codcli: string,
    @Body() body: { codneg?: number; fiar: boolean; limiteFiado?: number | null },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.setFiado({
      codcli: Number(codcli),
      codneg: codnegValue,
      fiar: Boolean(body.fiar),
      limiteFiado: body.limiteFiado ?? null,
      usermod: req.user?.audit ?? null,
    });
  }

  @Post()
  async crear(
    @Body() body: { codneg?: number; codper: number },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.crear({
      codneg: codnegValue,
      codper: Number(body.codper),
      usercrea: req.user?.audit ?? null,
    });
  }
}
