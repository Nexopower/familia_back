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
import { AuthService } from 'src/auth/auth.service';
import { ProveedoresService } from './proveedores.service';

@UseGuards(JwtAuthGuard)
@Controller('proveedores')
export class ProveedoresController {
  constructor(
    private readonly service: ProveedoresService,
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

  @Post()
  async crear(
    @Body()
    body: {
      codneg?: number;
      codper?: number | null;
      nombre?: string;
      telefono?: string;
      nota?: string;
    },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.crear({
      codneg: codnegValue,
      codper: body.codper == null ? null : Number(body.codper),
      nombre: body.nombre ?? null,
      telefono: body.telefono ?? null,
      nota: body.nota ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Patch(':codpro')
  async actualizar(
    @Param('codpro') codpro: string,
    @Body()
    body: {
      codneg?: number;
      codper?: number | null;
      nombre?: string | null;
      telefono?: string | null;
      nota?: string | null;
      estado?: 'A' | 'I';
    },
    @Request() req: any,
  ) {
    const codnegValue = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);
    return await this.service.actualizar({
      codpro: Number(codpro),
      codneg: codnegValue,
      codper: body.codper,
      nombre: body.nombre,
      telefono: body.telefono,
      nota: body.nota,
      estado: body.estado,
      usermod: req.user?.audit ?? null,
    });
  }
}
