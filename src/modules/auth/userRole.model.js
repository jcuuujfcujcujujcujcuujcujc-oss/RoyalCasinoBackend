'use strict';
const { DataTypes } = require('sequelize');
module.exports = (sequelize) =>
  sequelize.define(
    'UserRole',
    {
      userId: { type: DataTypes.INTEGER, primaryKey: true, field: 'user_id' },
      roleId: { type: DataTypes.INTEGER, primaryKey: true, field: 'role_id' },
    },
    { tableName: 'user_roles', underscored: true, timestamps: false }
  );
