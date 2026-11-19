'use strict';

const { Player, User, sequelize } = require('../../models');
const { createStarterProfile } = require('../player-credits/credit.service');
const { NotFoundError, ConflictError } = require('../../errors/AppError');
const { EDITABLE_FIELDS } = require('./player.validation');
const { record } = require('../audit/audit.service');

async function findOrFail(id, options = {}) {
  const player = await Player.findByPk(id, options);
  if (!player) throw new NotFoundError(`Игрок с id=${id} не найден`);
  return player;
}

async function list({ page, limit, sortBy, order, filters }) {
  const where = { ...filters };
  if (where.search) { const search = where.search; delete where.search; const { Op } = require('sequelize'); where[Op.or] = ['nickname', 'email'].map((field) => ({ [field]: { [Op.iLike]: `%${search.replace(/[\\%_]/g, '\\$&')}%` } })); }
  const { rows, count } = await Player.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [[sortBy, order.toUpperCase()], ['id', 'ASC']],
  });
  return { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
}

const getById = (id) => findOrFail(id);

// Дубликаты nickname/email ловят уникальные ограничения БД -> UniqueConstraintError -> 409.
// Игрок и его профиль виртуальных кредитов создаются в одной транзакции.
const create = (data, userId) =>
  sequelize.transaction(async (transaction) => {
    const player = await Player.create(data, { fields: EDITABLE_FIELDS, transaction });
    await createStarterProfile(player.id, transaction);
    await record({ userId, action: 'CREATE_PLAYER', entityType: 'Player', entityId: player.id, details: {} }, transaction);
    return player;
  });

async function replace(id, data, userId) {
  return sequelize.transaction(async (transaction) => {
    const player = await findOrFail(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (data.email !== undefined && player.userId) {
      const user = await User.findByPk(player.userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (user) { user.email = data.email; await user.save({ transaction }); }
    }
    await player.update(data, { fields: EDITABLE_FIELDS, transaction });
    await record({ userId, action: 'REPLACE_PLAYER', entityType: 'Player', entityId: id, details: { fields: Object.keys(data) } }, transaction);
    return player;
  });
}

const update = replace;

async function remove(id, userId) {
  await sequelize.transaction(async (transaction) => {
    const player = await findOrFail(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (player.userId) throw new ConflictError('Профиль связан с учётной записью; заблокируйте пользователя вместо удаления');
    await player.destroy({ transaction });
    await record({ userId, action: 'DELETE_PLAYER', entityType: 'Player', entityId: id, details: {} }, transaction);
  });
}

module.exports = { list, getById, create, replace, update, remove };
