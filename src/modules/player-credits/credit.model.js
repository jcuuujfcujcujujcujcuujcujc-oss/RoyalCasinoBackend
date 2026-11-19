'use strict';

const { DataTypes } = require('sequelize');

// Профиль виртуальных кредитов игрока. Кредиты не имеют денежной ценности.
// Отрицательный баланс запрещён CHECK в БД; NUMERIC остаётся строкой, без потери точности.
module.exports = (sequelize) => {
  const PlayerCreditProfile = sequelize.define(
    'PlayerCreditProfile',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      playerId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      balance: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
    },
    { tableName: 'player_credit_profiles', underscored: true, timestamps: true }
  );

  PlayerCreditProfile.associate = (models) => {
    PlayerCreditProfile.belongsTo(models.Player, {
      foreignKey: 'playerId',
      as: 'player',
      onDelete: 'CASCADE',
    });
  };

  return PlayerCreditProfile;
};
