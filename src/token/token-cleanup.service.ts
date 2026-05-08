import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SqlService } from 'src/sql/sql.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly sql: SqlService) {}

  /**
   * Ejecuta 2 veces al día: 12:00 AM (medianoche) y 12:00 PM (mediodía)
   * Limpia todos los tokens expirados (refresh tokens y tokens en blacklist)
   */
  @Cron('0 0 0,12 * * *')
  async cleanupExpiredTokens() {
    try {
      this.logger.log('🧹 Iniciando limpieza de tokens expirados...');

      // Limpiar refresh tokens expirados
      const deleteRefreshTokens = `
                DELETE FROM refresh_tokens 
                WHERE fecexp_rft < GETDATE()
            `;

      await this.sql.executeQuery(deleteRefreshTokens);
      this.logger.log('✅ Refresh tokens expirados eliminados');

      // Limpiar tokens revocados expirados
      const deleteBlacklistTokens = `
                DELETE FROM token_blacklist 
                WHERE fecexp_tbl < GETDATE()
            `;

      await this.sql.executeQuery(deleteBlacklistTokens);
      this.logger.log('✅ Tokens de blacklist expirados eliminados');

      this.logger.log('✨ Limpieza de tokens completada exitosamente');
    } catch (error) {
      this.logger.error(
        `❌ Error durante la limpieza de tokens: ${error.message}`,
        error.stack,
      );
    }
  }
}
