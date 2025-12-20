import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';

@Injectable()
export class SqlService {
  private readonly config: sql.config;

  constructor() {
    this.config = {
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      server: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT ?? '1433', 10),
      database: process.env.DATABASE_NAME,
      options: {
          encrypt: false,
          trustServerCertificate: true,
      },
    };
  }

  async executeQueryParams(query: string, params: any): Promise<any> {
    try {
      const pool = await sql.connect(this.config);
      const request = pool.request();

      if (params) {
        Object.keys(params).forEach(key => {
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

//   async executeTransaction(object: Transactions) {
//     let insert: any = {
//       inserted: false,
//       token_status: true
//     }
//     try {
//       const Connection = await sql.connect(this.config);
//       const transaction = new sql.Transaction(Connection);
//       const objectDetail: Array<TransactionDetails> = object.datails

//       await transaction.begin();
//       let rolledBack = false;

//       transaction.on('rollback', aborted => {
//         rolledBack = true;
//       });

//       let SqlCommandHeader = "EXEC SP_Transactions__Insert @Amount, @Date, @TransactionStatusID, @UserID, @Commission, @PartnerCommission, @TotalGainAmount, @PaidDate, @LotteryName, @TicketID, @Discount, @PrintQuantity, @LotteryShortName;";
//       const requestHeader = new sql.Request(transaction);

//       Object.keys(object).forEach(key => {
//         if (key !== "datails" && key !== "TransactionID") {
//           requestHeader.input(key, object[key])
//         }
//       });

//       try {
//         const result = await requestHeader.query(SqlCommandHeader);
//         const TransactionID = result.recordset[0]?.TransactionID;
//         let SqlCommandDetail = "EXEC sp_transactionDetails_insert @TransactionID, @LotteryID, @TransactionDetailID, @PlayTypeID, @Numbers, @TransactionStatusID, @Amount, @Commission, @PartnerCommission, @GainAmount, @LotteryName, @TicketDetailID;";

//         for (const element of objectDetail) {
//           const requestDetail = new sql.Request(transaction);
//           element.TransactionID = TransactionID;
//           Object.keys(element).forEach(key => {
//             requestDetail.input(key, element[key]);
//           });
//           await requestDetail.query(SqlCommandDetail);
//         }

//         await transaction.commit();
//         insert.inserted = true;
//       } catch (err) {
//         if (!rolledBack) {
//           await transaction.rollback();
//         }
//         console.error(err);
//       }
//     } catch (err) {
//       console.error(err);
//     }
//     return insert;
//   }
  async GETDATE(): Promise<Date> {
    const date = await this.executeQuery("SELECT GETDATE() AS DATE")
    return date[0].DATE;
  }

}

