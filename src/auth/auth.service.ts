import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from 'src/token/token.service';
import { SqlService } from 'src/sql/sql.service';
import { EncryptionService } from 'src/encryption/encryption.service';
import { Request } from 'express';

@Injectable()
export class AuthService {
    constructor(
        private readonly token: TokenService,
        private readonly sql: SqlService,
        private readonly encryption: EncryptionService
    ) { }

    /**
     * Login: valida usuario y contraseña, genera JWT
     */
    async login(codusr: string, password: string) {
        // Buscar usuario en BD
        const query = `
            SELECT codusr_usr, codper_usr, codrol_usr, codneg_usr, passwo_usr, estado_usr
            FROM usuario
            WHERE codusr_usr = @codusr
        `;

        const result = await this.sql.executeQueryParams(query, { codusr });

        if (!result || result.length === 0) {
            throw new UnauthorizedException('Usuario o contraseña incorrectos');
        }

        const user = result[0];

        // Verificar estado activo
        if (user.estado_usr !== 'A') {
            throw new UnauthorizedException('Usuario inactivo');
        }

        // Comparar contraseña hasheada
        const isPasswordValid = await this.encryption.comparePassword(
            password,
            user.passwo_usr
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException('Usuario o contraseña incorrectos');
        }

        // Generar tokens
        const { accessToken, refreshToken } = await this.token.GenerateTokenPair(
            user.codusr_usr,
            false
        );

        return {
            accessToken,
            refreshToken,
            user: {
                codusr: user.codusr_usr,
                codper: user.codper_usr,
                codrol: user.codrol_usr,
                codneg: user.codneg_usr
            }
        };
    }
    
    async validatedToken(request: Request) {
        const token: string | undefined = this.token.extractTokenFromHeader(request);
        if (!token) {
            throw new UnauthorizedException('Token not found');
        }
        const payload = await this.token.ValidatedToken(token);
        return payload;
    }

    async logout(request: Request) {
        const raw = this.token.extractTokenFromHeader(request);
        return await this.token.revokeToken(raw);
    }
}
