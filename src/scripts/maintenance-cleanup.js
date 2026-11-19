'use strict';

const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const env = require('../config/env');

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
      console.log(
        JSON.stringify({
          event: 'maintenance_cleanup_complete',
          refreshTokensDeleted: refresh.length,
          auditLogsDeleted: audit.length,
          auditRetentionDays: env.auditRetentionDays,
        })
      );
    });
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: 'maintenance_cleanup_failed', message: error.message }));
  process.exitCode = 1;
});
