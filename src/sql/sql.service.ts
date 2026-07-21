import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SqlService {
  private readonly config: sql.config;

  constructor(private readonly configService: ConfigService) {
    const dbConfig = this.configService.get('database');
    this.config = {
      user: dbConfig.user,
      password: dbConfig.password,
      server: dbConfig.server,
      port: dbConfig.port,
      database: dbConfig.database,
      options: {
        encrypt: dbConfig.options.encrypt,
        trustServerCertificate: dbConfig.options.trustServerCertificate,
      },
    };
  }

  async executeQueryParams(query: string, params: any): Promise<any> {
    try {
      const pool = await sql.connect(this.config);
      const request = pool.request();

      if (params) {
        Object.keys(params).forEach((key) => {
          request.input(key, params[key]);
        });
      }
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      throw new Error(`Error executing query: ${error}`);
    }
  }

  async executeQuery(query: string): Promise<any> {
    try {
      const Connection = await sql.connect(this.config);
      const result = await Connection.request().query(query);
      return result.recordset;
    } catch (error) {
      throw new Error(`Error executing query: ${error}`);
    }
  }

  /**
   * Inicia una transacción y la DEVUELVE al llamador.
   *
   * Importante: este service es un singleton compartido entre requests, por lo
   * que la transacción nunca se guarda como estado de instancia (dos requests
   * concurrentes se pisarían). El contexto vive en quien llama: pásala a
   * queryTransaction/commitTransaction/rollbackTransaction.
   */
  async beginTransaction(): Promise<sql.Transaction> {
    const connection = await sql.connect(this.config);
    const transaction = connection.transaction();
    await transaction.begin();

    transaction.on('rollback', (aborted) => {
      if (aborted) {
        console.log('Reverse transaction:', aborted);
      }
    });
    return transaction;
  }

  async queryTransaction<T extends {}>(
    transaction: sql.Transaction,
    query: string,
    params?: T,
  ) {
    if (!transaction) {
      throw new Error('The transaction has not been initiated.');
    }

    try {
      const request = new sql.Request(transaction);

      if (params) {
        Object.keys(params).forEach((key) => {
          request.input(key, params[key]);
        });
      }

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error in transaction query:', error);
      await this.rollbackTransaction(transaction);
      throw new Error(`Error executing transaction query: ${error}`);
    }
  }

  async commitTransaction(transaction: sql.Transaction) {
    if (!transaction) {
      throw new Error('No transaction to confirm.');
    }

    try {
      await transaction.commit();
    } catch (error) {
      console.error('Error confirming transaction:', error);
      throw new Error('Error confirming transaction');
    }
  }

  async rollbackTransaction(transaction: sql.Transaction) {
    if (!transaction) {
      console.log('There is no transaction to reverse.');
      return;
    }

    try {
      await transaction.rollback();
    } catch (error) {
      console.error('Error reversing transaction:', error);
      throw new Error('Error reversing transaction');
    }
  }
  async GETDATE(): Promise<Date> {
    const date = await this.executeQuery('SELECT GETDATE() AS DATE');
    return date[0].DATE;
  }
}
