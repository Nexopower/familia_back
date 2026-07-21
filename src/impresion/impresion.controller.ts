import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { PermisoGuard } from 'src/authz/permiso.guard';
import { RequirePermiso } from 'src/authz/permiso.decorator';
import { ImpresionService } from './impresion.service';

@UseGuards(JwtAuthGuard, PermisoGuard)
@Controller('impresion')
export class ImpresionController {
  constructor(
    private readonly service: ImpresionService,
    private readonly authService: AuthService,
  ) {}

  @Post('factura')
  @RequirePermiso('FACTURAS.VER')
  async imprimirFactura(
    @Body()
    body: {
      codneg?: number;
      codfac: number;
      tipo: string;
      abrirCajon?: boolean;
      montoPagado?: number | null;
      cambio?: number | null;
      fondoAplicado?: number | null;
      fiado?: number | null;
    },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.imprimirFactura({
      codneg,
      codfac: Number(body.codfac),
      tipo: body.tipo,
      abrirCajon: Boolean(body.abrirCajon),
      montoPagado: body.montoPagado == null ? null : Number(body.montoPagado),
      cambio: body.cambio == null ? null : Number(body.cambio),
      fondoAplicado: body.fondoAplicado == null ? null : Number(body.fondoAplicado),
      fiado: body.fiado == null ? null : Number(body.fiado),
    });
  }

  @Post('abrir-cajon')
  @RequirePermiso('FACTURAS.CREAR')
  async abrirCajon(
    @Body() body: { codneg?: number },
    @Request() req: any,
  ) {
    const codneg = Number(body.codneg ?? req.user?.codneg);
    await this.authService.assertCanAccessNegocio(req.user, codneg);
    return await this.service.abrirCajon(codneg);
  }
}
