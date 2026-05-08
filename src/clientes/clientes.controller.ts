import {
  Body,
  Controller,
  Get,
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
      usercrea: req.user?.sub ?? null,
    });
  }
}
