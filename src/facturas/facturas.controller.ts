import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { AuthzService } from 'src/authz/authz.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('facturas')
export class FacturasController {
  constructor(
    private readonly service: FacturasService,
    private readonly authService: AuthService,
    private readonly authz: AuthzService,
  ) {}

  /** Fiar es condicional al body, por eso se valida manualmente (no con decorator). */
  private async assertPuedeFiar(user: any, codneg: number) {
    const codusr = String(user?.sub ?? '');
    if (await this.authService.isSuperAdmin(codusr)) return;
    if (await this.authz.esDuenoDeNegocio(codusr, codneg)) return;
    const ok = await this.authz.tienePermiso(codusr, codneg, 'FACTURAS.FIAR');
    if (!ok) throw new ForbiddenException('No tienes permiso para fiar (FACTURAS.FIAR)');
  }

  private async assertPuedeFondo(user: any, codneg: number) {
    const codusr = String(user?.sub ?? '');
    if (await this.authService.isSuperAdmin(codusr)) return;
    if (await this.authz.esDuenoDeNegocio(codusr, codneg)) return;
    const ok = await this.authz.tienePermiso(codusr, codneg, 'FACTURAS.FONDO');
    if (!ok) throw new ForbiddenException('No tienes permiso para aplicar fondos (FACTURAS.FONDO)');
  }

  @Get()
  @RequirePermiso('FACTURAS.VER')
  async listar(
    @Query('codneg') codneg: number | undefined,
    @Query('tipo') tipo: string | undefined,
    @Query('estado') estado: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Query('limit') limit: number | undefined,
    @Request() req: any,
  ) {
    const codnegValue = Number(codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codnegValue);

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta) : null;

    return await this.service.listar({
      codneg: codnegValue,
      tipo: tipo ?? null,
      estado: estado ?? null,
      desde: desdeDate && !Number.isNaN(desdeDate.getTime()) ? desdeDate : null,
      hasta: hastaDate && !Number.isNaN(hastaDate.getTime()) ? hastaDate : null,
      limit: limit === undefined ? null : Number(limit),
    });
  }

  @Post()
  @RequirePermiso('FACTURAS.CREAR')
  async crear(
    @Body()
    body: { codneg?: number; tipo: string; codcli?: number; codpro?: number },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.crear({
      codneg,
      tipo: body.tipo,
      codcli: body.codcli ? Number(body.codcli) : undefined,
      codpro: body.codpro ? Number(body.codpro) : undefined,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post('completa')
  @RequirePermiso('FACTURAS.CREAR')
  async crearCompleta(
    @Body()
    body: {
      codneg?: number;
      tipo: string;
      // opcional: si viene vacío se usa contraparte genérica
      codcli?: number | null;
      codpro?: number | null;
      items: Array<{ codprd: number; cantidad: number; preuni?: number | null }>;
      cerrar?: boolean;
      efectivo?: number | null;
      fiar?: boolean;
      fiarMonto?: number | null;
      fondoAplicar?: number | null;
      fondoAdelantar?: boolean;
      autorizacion?: { codusr: string; auditId?: number | null } | null;
    },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    if (body.fiar) await this.assertPuedeFiar(req.user, codneg);
    if (Number(body.fondoAplicar ?? 0) > 0) await this.assertPuedeFondo(req.user, codneg);
    return await this.service.crearCompleta({
      codneg,
      tipo: body.tipo,
      codcli: body.codcli == null ? undefined : Number(body.codcli),
      codpro: body.codpro == null ? undefined : Number(body.codpro),
      items: Array.isArray(body.items) ? body.items : [],
      cerrar: Boolean(body.cerrar),
      efectivo: body.efectivo == null ? null : Number(body.efectivo),
      fiar: Boolean(body.fiar),
      fiarMonto: body.fiarMonto == null ? null : Number(body.fiarMonto),
      fondoAplicar: body.fondoAplicar == null ? null : Number(body.fondoAplicar),
      fondoAdelantar: Boolean(body.fondoAdelantar),
      autorizacion: body.autorizacion ?? null,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post('cerrar-lote')
  @RequirePermiso('FACTURAS.CERRAR')
  async cerrarLote(
    @Body()
    body: {
      codneg?: number;
      tipo?: string;
      desde?: string;
      hasta?: string;
      codfacs?: Array<{ codfac: number; tipo: string }>;
    },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    const desdeDate = body.desde ? new Date(body.desde) : null;
    const hastaDate = body.hasta ? new Date(body.hasta) : null;
    return await this.service.cerrarLote({
      codneg,
      tipo: body.tipo ?? null,
      desde: desdeDate && !Number.isNaN(desdeDate.getTime()) ? desdeDate : null,
      hasta: hastaDate && !Number.isNaN(hastaDate.getTime()) ? hastaDate : null,
      codfacs: Array.isArray(body.codfacs) ? body.codfacs : null,
      codusr: req.user?.sub ?? null,
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post(':codfac/detalle')
  @RequirePermiso('FACTURAS.CREAR')
  async agregarDetalle(
    @Param('codfac') codfac: string,
    @Body() body: { tipo?: string; codprd: number; cantidad: number; preuni?: number | null },
    @Request() req: any,
  ) {
    const tipo = body.tipo ?? req.query?.tipo;
    const meta = await this.service.obtenerMeta(Number(codfac), tipo ?? null);
    await this.authService.assertCanAccessNegocio(req.user, meta.codneg);
    return await this.service.agregarDetalle({
      tipo,
      codfac: Number(codfac),
      codprd: Number(body.codprd),
      cantidad: Number(body.cantidad),
      preuni:
        body.preuni === undefined || body.preuni === null
          ? null
          : Number(body.preuni),
      usercrea: req.user?.audit ?? null,
    });
  }

  @Post(':codfac/cerrar')
  @RequirePermiso('FACTURAS.CERRAR')
  async cerrar(@Param('codfac') codfac: string, @Query('tipo') tipo: string | undefined, @Request() req: any) {
    const meta = await this.service.obtenerMeta(Number(codfac), tipo ?? null);
    await this.authService.assertCanAccessNegocio(req.user, meta.codneg);
    return await this.service.cerrar(
      Number(codfac),
      tipo ?? meta.tipo,
      req.user?.sub ?? null,
      req.user?.audit ?? null,
    );
  }

  @Delete(':codfac')
  @RequirePermiso('FACTURAS.CREAR')
  async eliminar(
    @Param('codfac') codfac: string,
    @Query('tipo') tipo: string,
    @Request() req: any,
  ) {
    const meta = await this.service.obtenerMeta(Number(codfac), tipo ?? null);
    await this.authService.assertCanAccessNegocio(req.user, meta.codneg);
    return await this.service.eliminar(Number(codfac), tipo, req.user?.sub ?? null);
  }

  @Get(':codfac')
  @RequirePermiso('FACTURAS.VER')
  async obtener(
    @Param('codfac') codfac: string,
    @Query('tipo') tipo: string | undefined,
    @Request() req: any,
  ) {
    const meta = await this.service.obtenerMeta(Number(codfac), tipo ?? null);
    await this.authService.assertCanAccessNegocio(req.user, meta.codneg);
    return await this.service.obtener(Number(codfac), meta.codneg, tipo ?? meta.tipo);
  }
}
