'use strict';
const { Router } = require('express');
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../auth/auth.middleware');
const { User, Role, UserRole, AuditLog, sequelize } = require('../../models');
const { AppError } = require('../../errors/AppError');
const { record } = require('../audit/audit.service');
const { readPaging, finishQuery } = require('../../utils/validation');
const router = Router();
router.use(authenticate, authorize('ADMIN'));

function pagination(query) {
  const details = [];
  const result = readPaging(query, details);
  if ((result.page - 1) * result.limit > 1000000) details.push({ field: 'page', message: 'смещение страницы не должно превышать 1000000 записей' });
  return finishQuery(details, result);
}

router.get('/users', async (req, res) => {
  const { page, limit } = pagination(req.query);
  const users = await User.findAndCountAll({ limit, offset: (page - 1) * limit, order: [['id','ASC']], attributes: { exclude: ['passwordHash'] }, include: [{ model: Role, as: 'roles', through: { attributes: [] } }] });
  res.json({ data: users.rows, pagination: { page, limit, total: users.count, totalPages: Math.ceil(users.count / limit) } });
});
router.patch('/users/:id/active', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1 || typeof req.body?.isActive !== 'boolean') throw new AppError(422, 'Требуется целое id и булево isActive', 'VALIDATION_ERROR');
  if (id === req.auth.id && !req.body.isActive) throw new AppError(409, 'Нельзя заблокировать собственную учётную запись', 'CONFLICT');
  await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new AppError(404, 'Пользователь не найден', 'NOT_FOUND');
    user.isActive = req.body.isActive; await user.save({ transaction });
    if (!user.isActive) await require('../../models').RefreshToken.update({ revokedAt: new Date() }, { where: { userId: id, revokedAt: null }, transaction });
    await record({ userId: req.auth.id, action: user.isActive ? 'UNBLOCK_USER' : 'BLOCK_USER', entityType: 'User', entityId: id, details: { isActive: user.isActive } }, transaction);
  });
  res.status(204).end();
});
router.put('/users/:id/roles', async (req, res) => {
  const id = Number(req.params.id); const codes = req.body?.roles;
  if (!Number.isSafeInteger(id) || id < 1 || !Array.isArray(codes) || codes.length < 1 || codes.some((x) => !['ADMIN','MANAGER','PLAYER'].includes(x)) || new Set(codes).size !== codes.length) throw new AppError(422, 'Передайте непустой список допустимых ролей', 'VALIDATION_ERROR');
  if (id === req.auth.id && !codes.includes('ADMIN')) throw new AppError(409, 'Нельзя снять собственную роль ADMIN', 'CONFLICT');
  await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new AppError(404, 'Пользователь не найден', 'NOT_FOUND');
    const roles = await Role.findAll({ where: { code: { [Op.in]: codes } }, transaction });
    await user.setRoles(roles, { transaction });
    await record({ userId: req.auth.id, action: 'ASSIGN_ROLES', entityType: 'User', entityId: id, details: { roles: codes } }, transaction);
  });
  res.json({ data: { id, roles: codes } });
});
router.get('/audit-logs', async (req, res) => {
  const { page, limit } = pagination(req.query);
  const where = {};
  for (const key of ['action','entityType']) if (req.query[key] !== undefined) { if (typeof req.query[key] !== 'string' || req.query[key].length > 80) throw new AppError(422, `Некорректный ${key}`, 'VALIDATION_ERROR'); where[key] = req.query[key]; }
  if (req.query.userId !== undefined) { const userId = Number(req.query.userId); if (!Number.isSafeInteger(userId) || userId < 1) throw new AppError(422, 'Некорректный userId', 'VALIDATION_ERROR'); where.userId = userId; }
  for (const key of ['from','to']) if (req.query[key] !== undefined) { if (typeof req.query[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/.test(req.query[key])) throw new AppError(422, `Некорректная дата ${key}`, 'VALIDATION_ERROR'); const value = new Date(req.query[key]); if (Number.isNaN(value.getTime())) throw new AppError(422, `Некорректная дата ${key}`, 'VALIDATION_ERROR'); where.createdAt ||= {}; where.createdAt[key === 'from' ? Op.gte : Op.lte] = value; }
  if (where.createdAt?.[Op.gte] && where.createdAt?.[Op.lte] && where.createdAt[Op.gte] > where.createdAt[Op.lte]) throw new AppError(422, 'from не может быть позже to', 'VALIDATION_ERROR');
  const result = await AuditLog.findAndCountAll({ where, limit, offset: (page - 1) * limit, order: [['id','DESC']] });
  res.json({ data: result.rows, pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) } });
});
module.exports = router;
