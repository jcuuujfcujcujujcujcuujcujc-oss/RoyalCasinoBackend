'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CreditTransaction = sequelize.define(
    'CreditTransaction',
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      playerId: { type: DataTypes.INTEGER, allowNull: false, field: 'player_id' },
      type: { type: DataTypes.STRING(20), allowNull: false },
      amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
      balanceAfter: { type: DataTypes.DECIMAL(14, 2), allowNull: false, field: 'balance_after' },
      idempotencyKey: { type: DataTypes.STRING(128), allowNull: false, field: 'idempotency_key' },
      createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    },
    {
      tableName: 'credit_transactions',
      underscored: true,
      timestamps: false,
      indexes: [{ unique: true, fields: ['player_id', 'idempotency_key'] }],
    }
  );

  CreditTransaction.associate = (models) => {
    CreditTransaction.belongsTo(models.Player, { foreignKey: 'playerId', as: 'player' });
    CreditTransaction.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
  };

  return CreditTransaction;
};
