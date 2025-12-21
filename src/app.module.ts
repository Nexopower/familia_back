import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SqlService } from './sql/sql.service';
import configuration from './sql/config/configuration';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { TokenService } from './token/token.service';
import { TokenCleanupService } from './token/token-cleanup.service';
import { Tokenpass } from './const/const';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [configuration]
    }),
    JwtModule.register({
      global: true,
      secret: Tokenpass.secret,
      signOptions: { expiresIn: '1h' },
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    AppController,
    AuthController,
  ],
  providers: [
    AppService,
    SqlService,
    AuthService,
    TokenService,
    TokenCleanupService,
  ],
})
export class AppModule { }