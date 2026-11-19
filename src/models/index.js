'use strict';

const { Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');
const defineProduct = require('../modules/products/product.model');
const defineGameCategory = require('../modules/game-categories/gameCategory.model');
const definePlayer = require('../modules/players/player.model');
const defineCreditProfile = require('../modules/player-credits/credit.model');
const defineCreditTransaction = require('../modules/player-credits/creditTransaction.model');
const defineUser = require('../modules/auth/user.model');
const defineRole = require('../modules/auth/role.model');
const defineUserRole = require('../modules/auth/userRole.model');
const defineRefreshToken = require('../modules/auth/refreshToken.model');
const defineAuditLog = require('../modules/audit/auditLog.model');

const models = {
  Product: defineProduct(sequelize),
  GameCategory: defineGameCategory(sequelize),
  Player: definePlayer(sequelize),
  PlayerCreditProfile: defineCreditProfile(sequelize),
  CreditTransaction: defineCreditTransaction(sequelize),
  User: defineUser(sequelize),
  Role: defineRole(sequelize),
  UserRole: defineUserRole(sequelize),
  RefreshToken: defineRefreshToken(sequelize),
  AuditLog: defineAuditLog(sequelize),
};

models.User.belongsToMany(models.Role, { through: models.UserRole, foreignKey: 'userId', as: 'roles' });
models.Role.belongsToMany(models.User, { through: models.UserRole, foreignKey: 'roleId', as: 'users' });
models.User.hasMany(models.RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
models.User.hasMany(models.AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
models.User.hasMany(models.CreditTransaction, { foreignKey: 'createdBy', as: 'creditTransactions' });
models.Player.hasMany(models.CreditTransaction, { foreignKey: 'playerId', as: 'creditTransactions' });
models.User.hasOne(models.Player, { foreignKey: 'userId', as: 'player' });
models.Player.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') model.associate(models);
});

module.exports = { sequelize, Sequelize, ...models };
