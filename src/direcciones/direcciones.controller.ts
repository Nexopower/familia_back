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
import { DireccionesService } from './direcciones.service';

@UseGuards(JwtAuthGuard)
@Controller('direcciones')
export class DireccionesController {
  constructor(private readonly service: DireccionesService) {}

  @Get('buscar')
  async buscar(@Query('q') q: string) {
    return await this.service.buscar(q);
  }

  @Get()
  async listar(@Query('limit') limit?: string) {
    return await this.service.listar(limit ? Number(limit) : undefined);
  }

  @Post()
  async crear(
    @Body()
    body: { direccion: string; sector?: string; ciudad?: string; referencia?: string },
    @Request() req: any,
  ) {
    return await this.service.crear({
      ...body,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Patch(':coddir')
  async actualizar(
    @Param('coddir') coddir: string,
    @Body()
    body: {
      direccion?: string;
      sector?: string | null;
      ciudad?: string | null;
      referencia?: string | null;
      estado?: 'A' | 'I';
    },
    @Request() req: any,
  ) {
    return await this.service.actualizar({
      coddir: Number(coddir),
      ...body,
      usermod: req.user?.audit ?? null,
    });
  }
}
