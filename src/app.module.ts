import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SqlService } from './sql/sql.service';
import configuration from './sql/config/configuration';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { TokenService } from './token/token.service';

@Module({
  imports: [ConfigModule.forRoot({
    envFilePath: '.env',
    isGlobal: true,
    load: [configuration]
  })],
  controllers: [
    AppController,
    AuthController,
  ],
  providers: [
    AppService,
    SqlService,
    AuthService,
    TokenService,
  ],
})
export class AppModule { }