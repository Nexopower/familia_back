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
import { PersonasService } from './personas.service';

@UseGuards(JwtAuthGuard)
@Controller('personas')
export class PersonasController {
  constructor(private readonly service: PersonasService) {}

  @Get('buscar')
  async buscar(@Query('q') q: string) {
    return await this.service.buscar(q);
  }

  @Get()
  async listar(@Query('limit') limit?: string) {
    return await this.service.listar(limit ? Number(limit) : undefined);
  }

  @Patch(':codper')
  async actualizar(
    @Param('codper') codper: string,
    @Body()
    body: {
      nombre?: string;
      apellido?: string;
      email?: string | null;
      telefono?: string | null;
      direccion?: string | null;
      cedula?: string | null;
      codsex?: string | null;
      fecnac?: string | null;
    },
    @Request() req: any,
  ) {
    return await this.service.actualizar({
      codper: Number(codper),
      ...body,
      usermod: req.user?.audit ?? null,
    });
  }

  @Post()
  async crear(
    @Body()
    body: {
      nombre: string;
      apellido?: string;
      email?: string;
      telefono?: string;
      direccion?: string;
      codsex?: string;
      fecnac?: string;
    },
    @Request() req: any,
  ) {
    return await this.service.crear({
      ...body,
      usercrea: req.user?.audit ?? null,
    });
  }
}
