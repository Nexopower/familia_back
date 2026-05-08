import {
  Body,
  Controller,
  Get,
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
