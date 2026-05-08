import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SqlService {
  private readonly config: sql.config;
  // private rolledBack = false;
  private transaction: sql.Transaction | null = null;

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

  async beginTransaction() {
    try {
      const connection = await sql.connect(this.config);
      this.transaction = connection.transaction();
      await this.transaction.begin();

      this.transaction.on('rollback', (aborted) => {
        if (aborted) {
          console.log('Reverse transaction:', aborted);
        }
      });
      // console.log('Transaction successfully initiated');
    } catch (error) {
      console.error('Error initiating transaction:', error);
    }
  }

  async queryTransaction<T extends {}>(query: string, params?: T) {
    if (!this.transaction) {
      throw new Error('The transaction has not been initiated.');
    }

    try {
      const request = new sql.Request(this.transaction);

      if (params) {
        Object.keys(params).forEach((key) => {
          request.input(key, params[key]);
        });
      }

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error in transaction query:', error);
      await this.rollbackTransaction();
      throw new Error(`Error executing transaction query: ${error}`);
    }
  }

  async commitTransaction() {
    if (!this.transaction) {
      throw new Error('No transaction to confirm.');
    }

    try {
      await this.transaction.commit();
      // console.log('Transaction successfully confirmed');
    } catch (error) {
      console.error('Error confirming transaction:', error);
      throw new Error('Error confirming transaction');
    } finally {
      this.transaction = null;
    }
  }

  async rollbackTransaction() {
    if (!this.transaction) {
      console.log('There is no transaction to reverse.');
      return;
    }

    try {
      await this.transaction.rollback();
      // console.log('Transaction successfully reversed');
    } catch (error) {
      console.error('Error reversing transaction:', error);
      throw new Error('Error reversing transaction');
    } finally {
      this.transaction = null;
    }
  }
  async GETDATE(): Promise<Date> {
    const date = await this.executeQuery('SELECT GETDATE() AS DATE');
    return date[0].DATE;
  }
}
