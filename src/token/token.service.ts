import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { SqlService } from 'src/sql/sql.service';

@Injectable()
export class TokenService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly sql: SqlService
    ) { }

    /**
     * Genera un JWT con userId y expiración
     * @param userId ID del usuario
     * @param expiresIn Tiempo de expiración en segundos (ej: 3600, 1800, 604800)
     */
    async GenerateToken(userId: string | number, expiresIn: number = 3600): Promise<string> {
        const payload = { 
            sub: String(userId),
        };

        const token = await this.jwtService.signAsync(payload, { expiresIn });
        return token;
    }

    /**
     * Genera un par de access token + refresh token
     * @param userId ID del usuario
     * @param rememberMe Si es true, el refresh token dura 30 días, sino 7 días
     */
    async GenerateTokenPair(userId: string | number, rememberMe: boolean = false) {
        const accessToken = await this.GenerateToken(userId, 900); // 15 minutos
        const refreshToken = await this.GenerateRefreshToken(userId, rememberMe ? 2592000 : 604800); // 30d o 7d
        
        return {
            accessToken,
            refreshToken,
            expiresIn: 900
        };
    }

    /**
     * Genera un refresh token y lo guarda en BD
     */
    private async GenerateRefreshToken(userId: string | number, expiresIn: number = 604800): Promise<string> {
        const refreshToken = await this.jwtService.signAsync(
            { sub: String(userId), type: 'refresh' },
            { expiresIn }
        );

        // Guardar refresh token en la BD
        const expiresAt = new Date(Date.now() + (expiresIn * 1000));
        const query = `
            INSERT INTO refresh_tokens (token_rft, codusr_rft, fecexp_rft, usercrea)
            VALUES (@token, @userId, @expiresAt, @userId)
        `;
        
        await this.sql.executeQueryParams(query, {
            token: refreshToken,
            userId: Number(userId),
            expiresAt: expiresAt
        });

        return refreshToken;
    }

    /**
     * Renueva el access token usando un refresh token
     */
    async RefreshAccessToken(refreshToken: string) {
        try {
            // Verificar que el refresh token existe en la BD y no ha expirado
            const query = `
                SELECT * FROM refresh_tokens 
                WHERE token_rft = @token AND fecexp_rft > GETDATE()
            `;
            
            const result = await this.sql.executeQueryParams(query, {
                token: refreshToken
            });

            if (!result || result.length === 0) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Verificar firma del refresh token
            const payload = await this.jwtService.verifyAsync(refreshToken);
            
            if (payload.type !== 'refresh') {
                throw new UnauthorizedException('Invalid token type');
            }

            // Generar nuevo access token
            const accessToken = await this.GenerateToken(payload.sub, 900);

            return {
                accessToken,
                expiresIn: 900
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    /**
     * Valida y decodifica un JWT
     */
    async ValidatedToken(token: string) {
        try {
            // Verificar si está en blacklist (BD)
            const query = `
                SELECT * FROM token_blacklist 
                WHERE token_tbl = @token AND fecexp_tbl > GETDATE()
            `;
            
            const blacklisted = await this.sql.executeQueryParams(query, {
                token: token
            });

            if (blacklisted && blacklisted.length > 0) {
                throw new UnauthorizedException('Token has been revoked');
            }

            // Verificar y decodificar
            const payload = await this.jwtService.verifyAsync(token);
            return payload;
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    /**
     * Extrae el token del header Authorization
     */
    extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }

    /**
     * Obtiene información del usuario desde el token
     */
    async getUserToken(token: string) {
        const payload = await this.ValidatedToken(token);
        return {
            userId: payload.sub,
            issuedAt: new Date(payload.iat * 1000),
            expiresAt: new Date(payload.exp * 1000)
        };
    }

    /**
     * Revoca un access token agregándolo a la blacklist en BD
     */
    async revokeToken(rawToken: string | undefined) {
        if (!rawToken) {
            return { SUCCESS: false, CODE: 'NO_TOKEN' };
        }

        try {
            // Decodificar para obtener tiempo restante
            const payload = await this.jwtService.verifyAsync(rawToken);
            const ttl = payload.exp - Math.floor(Date.now() / 1000);
            
            if (ttl > 0) {
                // Agregar a blacklist en BD con fecha de expiración
                const expiresAt = new Date(payload.exp * 1000);
                const query = `
                    INSERT INTO token_blacklist (token_tbl, fecexp_tbl, usercrea)
                    VALUES (@token, @expiresAt, @userId)
                `;

                await this.sql.executeQueryParams(query, {
                    token: rawToken,
                    expiresAt: expiresAt,
                    userId: payload.sub
                });
            }
            
            return { SUCCESS: true, CODE: 'TOKEN_REVOKED' };
        } catch (error) {
            return { SUCCESS: false, CODE: 'INVALID_TOKEN' };
        }
    }

    /**
     * Revoca un refresh token (logout completo)
     */
    async revokeRefreshToken(refreshToken: string) {
        try {
            const query = `DELETE FROM refresh_tokens WHERE token_rft = @token`;
            await this.sql.executeQueryParams(query, {
                token: refreshToken
            });

            return { 
                SUCCESS: true, 
                CODE: 'REFRESH_TOKEN_REVOKED'
            };
        } catch (error) {
            return { 
                SUCCESS: false, 
                CODE: 'REFRESH_TOKEN_NOT_FOUND' 
            };
        }
    }

    /**
     * Revoca todos los tokens de un usuario (logout de todos los dispositivos)
     */
    async revokeAllUserTokens(userId: number) {
        try {
            const query = `DELETE FROM refresh_tokens WHERE codusr_rft = @userId`;
            await this.sql.executeQueryParams(query, {
                userId: userId
            });

            return { SUCCESS: true, CODE: 'ALL_TOKENS_REVOKED', count: 0 };
        } catch (error) {
            return { SUCCESS: false, CODE: 'ERROR_REVOKING_TOKENS', count: 0 };
        }
    }
}
