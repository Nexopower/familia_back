import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TokenService } from 'src/token/token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly tokenService: TokenService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.tokenService.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('Token no proporcionado');
        }

        try {
            // Validar y decodificar el token
            const payload = await this.tokenService.ValidatedToken(token);
            
            // Adjuntar payload al request para uso posterior
            request.user = payload;
            
            return true;
        } catch (error) {
            throw new UnauthorizedException('Token inválido o expirado');
        }
    }
}
