import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from 'src/token/token.service';
import { Request } from 'express';

@Injectable()
export class AuthService {
    constructor(private readonly token: TokenService) { }
    
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
