'use strict';

const { Sequelize } = require('sequelize');
const env = require('./env');
const { logger } = require('../utils/logger');

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
  logger.info(
    { host: env.db.host, port: env.db.port, database: env.db.name },
    'database connection established'
  );
}

module.exports = { sequelize, dbConfig, connectDatabase };
