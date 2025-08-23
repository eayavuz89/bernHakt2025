import 'dotenv/config';
import { Sequelize } from 'sequelize';

const {
  DB_HOST = '156.67.81.37',
  DB_PORT = '3310',
  DB_NAME = 'bernhack',
  DB_USER = 'bernhackuser',
  DB_PASS = 'S3cureP@ss'
} = process.env;

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'mysql',
  dialectModule: (await import('mysql2')).default,
  logging: false,
});
