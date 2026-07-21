import {
  Controller,
  Get,
  Post,
  Request,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { EncryptionService } from 'src/encryption/encryption.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { RequestUser } from 'src/auth/auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * POST /auth/login
   * Login con usuario y contraseña
   */
  @Post('login')
  async login(
    @Body()
    body: {
      codusr?: string;
      nombre?: string;
      password: string;
      codneg?: number;
    },
  ) {
    return await this.service.login({
      codusr: body.codusr,
      nombre: body.nombre,
      password: body.password,
      codneg: body.codneg,
    });
  }

  /**
   * GET /auth/negocios
   * Lista negocios activos para selector de login.
   */
  @Get('negocios')
  async listNegociosForLogin() {
    return await this.service.listNegociosForLogin();
  }

  /**
   * GET /auth/mis-negocios
   * Lista negocios accesibles del usuario autenticado.
   */
  @UseGuards(JwtAuthGuard)
  @Get('mis-negocios')
  async listMyNegocios(@Request() req: RequestUser) {
    return await this.service.listNegociosForUserContext(req.user);
  }

  /**
   * POST /auth/hash-password
   * Genera hash de contraseña (útil para crear usuarios)
   */
  @Post('hash-password')
  async hashPassword(@Body() body: { password: string }) {
    const hash = await this.encryption.hashPassword(body.password);
    return {
      password: body.password,
      hash: hash,
    };
  }

  /**
   * GET /auth/validate
   * Valida el token actual
   */
  @Get('validate')
  async validateToken(@Request() req: any) {
    return await this.service.validatedToken(req);
  }

  /**
   * POST /auth/refresh
   * Renueva access token usando refresh token.
   */
  @Post('refresh')
  async refresh(@Body() body: { refreshToken?: string }) {
    return await this.service.refreshAccessToken({
      refreshToken: body?.refreshToken,
    });
  }

  /**
   * POST /auth/switch-negocio
   * Emite un nuevo access token con el negocio seleccionado.
   */
  @UseGuards(JwtAuthGuard)
  @Post('switch-negocio')
  async switchNegocio(
    @Body() body: { codneg: number | null },
    @Request() req: RequestUser,
  ) {
    // codneg null = volver a la vista general (sesión sin negocio).
    return await this.service.switchNegocio(
      req.user,
      body.codneg == null ? null : Number(body.codneg),
    );
  }

  /**
   * POST /auth/logout
   * Cierra sesión revocando el token
   */
  @Post('logout')
  async logout(@Request() req: any) {
    return await this.service.logout(req);
  }
}
