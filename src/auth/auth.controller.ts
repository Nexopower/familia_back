import { Controller, Get, Post, Request, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EncryptionService } from 'src/encryption/encryption.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly service: AuthService,
        private readonly encryption: EncryptionService
    ) { }

    /**
     * POST /auth/login
     * Login con usuario y contraseña
     */
    @Post('login')
    async login(@Body() body: { codusr: string; password: string }) {
        return await this.service.login(body.codusr, body.password);
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
            hash: hash
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
     * POST /auth/logout
     * Cierra sesión revocando el token
     */
    @Post('logout')
    async logout(@Request() req: any) {
        return await this.service.logout(req);
    }
}
