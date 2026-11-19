'use strict';
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('AuditLog', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: true, field: 'user_id' },
  action: { type: DataTypes.STRING(80), allowNull: false },
  entityType: { type: DataTypes.STRING(80), allowNull: false, field: 'entity_type' },
  entityId: { type: DataTypes.STRING(80), allowNull: true, field: 'entity_id' },
  details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { tableName: 'audit_logs', underscored: true, updatedAt: false });
