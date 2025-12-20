import { Controller, Get, Post, Request } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly service:AuthService){}
    @Get()
    async validateToken(@Request() req:any){
        return await this.service.validatedToken(req);
    }

    @Post('logout')
    async logout(@Request() req:any){
        return await this.service.logout(req);
    }
}
