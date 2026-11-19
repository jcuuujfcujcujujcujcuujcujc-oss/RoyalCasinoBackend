'use strict';

const { DataTypes } = require('sequelize');
const { CATEGORIES, VOLATILITIES } = require('./product.validation');

// PostgreSQL возвращает NUMERIC строкой, отдаём клиенту число
const numericGetter = (field) =>
  function get() {
    const value = this.getDataValue(field);
    return value === null || value === undefined ? value : Number(value);
  };

// Игровой продукт онлайн-казино (игра в лобби). Все суммы - виртуальные кредиты.
module.exports = (sequelize) => {
  const Product = sequelize.define(
    'Product',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { notEmpty: true },
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      category: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [CATEGORIES] },
      },
      // Игровой провайдер (студия); 'Unknown' для записей, созданных до появления поля
      provider: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Unknown',
        validate: { notEmpty: true },
      },
      volatility: {
        type: DataTypes.STRING(6),
        allowNull: false,
        defaultValue: 'MEDIUM',
        validate: { isIn: [VOLATILITIES] },
      },
      // Связь с GameCategory (nullable: старые записи и совместимость API). FK и RESTRICT задаёт миграция.
      categoryId: { type: DataTypes.INTEGER, allowNull: true },
      minBet: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.1,
        validate: { min: 0.01 },
        get: numericGetter('minBet'),
      },
      maxBet: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { min: 0.01 },
        get: numericGetter('maxBet'),
      },
      rtp: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        validate: { min: 0, max: 100 },
        get: numericGetter('rtp'),
      },
      tablesCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0, isInt: true },
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'products',
      underscored: true,
      timestamps: true,
      validate: {
        // Второй уровень защиты межполевого правила (первый - в product.validation.js)
        betRange() {
          if (Number(this.minBet) > Number(this.maxBet)) {
            throw new Error('minBet не может быть больше maxBet');
          }
        },
      },
    }
  );

  Product.associate = (models) => {
    Product.belongsTo(models.GameCategory, {
      foreignKey: 'categoryId',
      as: 'gameCategory',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  };

  return Product;
};
