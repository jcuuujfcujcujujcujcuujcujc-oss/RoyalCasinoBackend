'use strict';

const { Sequelize } = require('sequelize');
const env = require('./env');

// Формат совместим и с Sequelize, и с sequelize-cli
const dbConfig = {
  username: env.db.user,
  password: env.db.password,
  database: env.db.name,
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.db.logging ? console.log : false,
  dialectOptions: env.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  define: { underscored: true },
};

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

async function connectDatabase() {
  await sequelize.authenticate(); // только проверка соединения, схему НЕ трогаем
  console.log(`База данных доступна: ${env.db.host}:${env.db.port}/${env.db.name}`);
}

module.exports = { sequelize, dbConfig, connectDatabase };
