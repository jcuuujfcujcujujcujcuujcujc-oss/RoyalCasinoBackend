'use strict';

const env = require('./config/env');
const app = require('./app');
const { connectDatabase } = require('./config/database');
const { sequelize } = require('./models');

async function start() {
  await connectDatabase(); // схему не синхронизируем: этим занимаются миграции

  const server = app.listen(env.port, () => {
    console.log(`Сервер запущен: http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal}: завершаем работу...`);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  console.error('Необработанный rejection:', reason);
  process.exit(1);
});

start().catch((err) => {
  console.error('Не удалось запустить сервер:', err);
  process.exit(1);
});
