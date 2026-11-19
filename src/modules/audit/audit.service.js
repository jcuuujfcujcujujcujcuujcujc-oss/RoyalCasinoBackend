'use strict';
const { AuditLog } = require('../../models');
function record(entry, transaction) {
  return AuditLog.create(
    {
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId == null ? null : String(entry.entityId),
      details: entry.details || {},
    },
    transaction ? { transaction } : undefined
  );
}
module.exports = { record };
