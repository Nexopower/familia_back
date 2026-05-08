import { Injectable } from '@nestjs/common';
import { SqlService } from './sql/sql.service';

@Injectable()
export class AppService {
  constructor(private readonly sqlService: SqlService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkHealth() {
    try {
      const result = await this.sqlService.executeQuery('SELECT 1 AS test');
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        result: result,
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
