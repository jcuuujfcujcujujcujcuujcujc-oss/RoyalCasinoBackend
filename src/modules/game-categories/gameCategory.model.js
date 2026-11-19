'use strict';

const { DataTypes } = require('sequelize');

// Категория игр каталога (1 GameCategory -> N Product). Уникальность имени без учёта регистра
// обеспечивает функциональный индекс в БД (см. миграцию), модель её не дублирует.
module.exports = (sequelize) => {
  const GameCategory = sequelize.define(
    'GameCategory',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'game_categories', underscored: true, timestamps: true }
  );

  GameCategory.associate = (models) => {
    // RESTRICT: категорию с продуктами удалить нельзя (дублируется внешним ключом в PostgreSQL)
    GameCategory.hasMany(models.Product, {
      foreignKey: 'categoryId',
      as: 'products',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  };

  return GameCategory;
};
