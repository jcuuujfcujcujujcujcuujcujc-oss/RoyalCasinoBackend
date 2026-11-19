'use strict';

const { DataTypes } = require('sequelize');

// Учебный игрок каталога: только профиль, без кошелька, платежей и ставок.
// Уникальность nickname (без учёта регистра) и email гарантируют ограничения БД (см. миграцию).
module.exports = (sequelize) => {
  const Player = sequelize.define(
    'Player',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      nickname: { type: DataTypes.STRING(30), allowNull: false, validate: { len: [3, 30] } },
      email: { type: DataTypes.STRING(254), allowNull: false, validate: { isEmail: true } },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      userId: { type: DataTypes.INTEGER, allowNull: true, unique: true, field: 'user_id' },
    },
    { tableName: 'players', underscored: true, timestamps: true }
  );

  Player.associate = (models) => {
    // Профиль кредитов удаляется вместе с игроком (ON DELETE CASCADE в БД)
    Player.hasOne(models.PlayerCreditProfile, {
      foreignKey: 'playerId',
      as: 'creditProfile',
      onDelete: 'CASCADE',
    });
  };

  return Player;
};
