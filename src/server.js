'use strict';

const env = require('./config/env');
const app = require('./app');
const { connectDatabase } = require('./config/database');
const { sequelize } = require('./models');
const { logger } = require('./utils/logger');

async function start() {
  await connectDatabase(); // схему не синхронизируем: этим занимаются миграции

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, environment: env.nodeEnv }, 'server listening');
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'graceful shutdown started');
    const forceExit = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      try {
        await sequelize.close();
        clearTimeout(forceExit);
        logger.info({ signal }, 'graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ errorName: error.name }, 'database close failed during shutdown');
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reasonType: reason?.name || typeof reason }, 'unhandled rejection');
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ errorName: err.name, errorCode: err.code }, 'server startup failed');
  process.exit(1);
});
