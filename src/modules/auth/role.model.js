'use strict';
const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define(
    'Role',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
    },
    { tableName: 'roles', underscored: true, timestamps: false }
  );
