export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    server: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT ?? '1433', 10),
    database: process.env.DATABASE_NAME,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  },
});
