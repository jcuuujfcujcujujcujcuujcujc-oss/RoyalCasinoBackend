'use strict';

const { Op } = require('sequelize');
const { User, Role, RefreshToken, AuditLog, sequelize } = require('../../models');
const { ConflictError, NotFoundError, ValidationError } = require('../../errors/AppError');
const { record } = require('../audit/audit.service');

async function listUsers({ page, limit }) {
  const result = await User.findAndCountAll({
    limit,
    offset: (page - 1) * limit,
    order: [['id', 'ASC']],
    distinct: true,
    attributes: { exclude: ['passwordHash'] },
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
  });
  return {
    data: result.rows,
    pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) },
  };
}

async function updateActive({ actorId, userId, isActive }) {
  if (actorId === userId && !isActive)
    throw new ConflictError('Нельзя заблокировать собственную учётную запись');
  await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new NotFoundError('Пользователь не найден');
    user.isActive = isActive;
    await user.save({ transaction });
    if (!isActive) {
      await RefreshToken.update(
        { revokedAt: new Date() },
        { where: { userId, revokedAt: null }, transaction }
      );
    }
    await record(
      {
        userId: actorId,
        action: isActive ? 'UNBLOCK_USER' : 'BLOCK_USER',
        entityType: 'User',
        entityId: userId,
        details: { isActive },
      },
      transaction
    );
  });
}

async function assignRoles({ actorId, userId, roleCodes }) {
  if (actorId === userId && !roleCodes.includes('ADMIN'))
    throw new ConflictError('Нельзя снять собственную роль ADMIN');
  await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new NotFoundError('Пользователь не найден');
    const roles = await Role.findAll({ where: { code: { [Op.in]: roleCodes } }, transaction });
    if (roles.length !== roleCodes.length)
      throw new ValidationError([{ field: 'roles', message: 'Одна или несколько ролей не существуют' }]);
    await user.setRoles(roles, { transaction });
    await record(
      {
        userId: actorId,
        action: 'ASSIGN_ROLES',
        entityType: 'User',
        entityId: userId,
        details: { roles: roleCodes },
      },
      transaction
    );
  });
  return { id: userId, roles: roleCodes };
}

async function listAuditLogs({ page, limit, where }) {
  const result = await AuditLog.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [['id', 'DESC']],
  });
  return {
    data: result.rows,
    pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) },
  };
}

module.exports = { listUsers, updateActive, assignRoles, listAuditLogs };
