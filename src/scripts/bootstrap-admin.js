'use strict';
require('../config/env');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { sequelize, User, Role, UserRole } = require('../models');
const { record } = require('../modules/audit/audit.service');
const { logger } = require('../utils/logger');

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
    !password ||
    Buffer.byteLength(password) < 12 ||
    Buffer.byteLength(password) > 72
  ) {
    throw new Error(
      'Задайте ADMIN_EMAIL и ADMIN_PASSWORD (пароль 12–72 байта) во временном окружении перед запуском'
    );
  }
  await sequelize.transaction(async (transaction) => {
    let user = await User.findOne({ where: { email }, transaction, lock: transaction.LOCK.UPDATE });
    if (!user)
      user = await User.create(
        { email, passwordHash: await bcrypt.hash(password, env.auth.bcryptRounds) },
        { transaction }
      );
    const role = await Role.findOne({ where: { code: 'ADMIN' }, transaction });
    if (!role) throw new Error('Роль ADMIN отсутствует. Сначала примените миграции.');
    await UserRole.findOrCreate({ where: { userId: user.id, roleId: role.id }, transaction });
    await record(
      { userId: user.id, action: 'BOOTSTRAP_ADMIN', entityType: 'User', entityId: user.id, details: {} },
      transaction
    );
    logger.info({ userId: user.id }, 'administrator bootstrapped');
  });
}
main()
  .catch((error) => {
    logger.error({ errorName: error.name, errorCode: error.code }, 'administrator bootstrap failed');
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
