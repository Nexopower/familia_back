import { Injectable } from '@nestjs/common';
import { Encryption } from 'src/class/encryption.class';
import { SqlService } from 'src/sql/sql.service';
import { Tokenpass } from '../const/const';
import { UserToken } from 'src/class/all.class';
import { Request } from 'express';


@Injectable()
export class TokenService {
    constructor(private readonly sql: SqlService) { }

    async GenerateToken(textToEncrypt: string, expired: boolean = false, time?: number) {
        const encryptionInstance = new Encryption();
        await encryptionInstance.initialize(Tokenpass.secret);

        const userToken = new UserToken();
        userToken.UserID = Number(textToEncrypt);
        userToken.token = await encryptionInstance.encryption(textToEncrypt.repeat(20));
        userToken.expired = expired;
        if (expired) {
            const expiredDete: Date = await this.sql.GETDATE();
            expiredDete.setMinutes(new Date().getMinutes() + (time ?? 60));
            userToken.expiredDate = expiredDete;
        }
        await this.RegisterToken(userToken);
        return userToken.token;
    }

    async RegisterToken(userToken: UserToken) {
        let sql: string = "EXEC SP_INSERT_USERTOKEN @UserID, @token, @expiredDate, @expired";
        return await this.sql.executeQueryParams(sql, userToken)[0];
    }

    async ValidatedToken(value: string) {
        return await this.sql.executeQueryParams("EXEC SP_VALIDATE_TOKEN @token", { token: value });
    }

    extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }

    async getUserToken(value: string) {
        return await this.sql.executeQueryParams("EXEC SP_GET_USER_TOKEN @token", { token: value });
    }

    async revokeToken(rawToken: string | undefined) {
        if (!rawToken) return { SUCCESS: false, CODE: 'NO_TOKEN' };
        const result = await this.sql.executeQueryParams("EXEC SP_LOGOUT @token", { token: rawToken });
        return result[0];
    }
}
