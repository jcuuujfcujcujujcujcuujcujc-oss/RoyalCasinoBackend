'use strict';

const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const env = require('../config/env');
const { logger } = require('../utils/logger');

async function main() {
  try {
    await sequelize.transaction(async (transaction) => {
      const refresh = await sequelize.query(
        `DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days' RETURNING id`,
        { transaction, type: QueryTypes.SELECT }
      );
      const audit = await sequelize.query(
        `DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - (:days * INTERVAL '1 day') RETURNING id`,
        { replacements: { days: env.auditRetentionDays }, transaction, type: QueryTypes.SELECT }
      );
      logger.info(
        {
          refreshTokensDeleted: refresh.length,
          auditLogsDeleted: audit.length,
          auditRetentionDays: env.auditRetentionDays,
        },
        'maintenance cleanup complete'
      );
    });
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  logger.error({ errorName: error.name, errorCode: error.code }, 'maintenance cleanup failed');
  process.exitCode = 1;
});
