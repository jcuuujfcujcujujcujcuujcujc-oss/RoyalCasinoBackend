'use strict';

const { GameCategory, Product, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { NotFoundError, ConflictError } = require('../../errors/AppError');
const { EDITABLE_FIELDS } = require('./gameCategory.validation');
const { record } = require('../audit/audit.service');

async function findOrFail(id, options = {}) {
  const category = await GameCategory.findByPk(id, options);
  if (!category) throw new NotFoundError(`Категория с id=${id} не найдена`);
  return category;
}

async function list({ page, limit, sortBy, order, filters }) {
  const where = { ...filters };
  if (where.search) {
    const search = where.search;
    delete where.search;
    where[Op.or] = ['name', 'description'].map((field) => ({
      [field]: { [Op.iLike]: `%${search.replace(/[\\%_]/g, '\\$&')}%` },
    }));
  }
  const { rows, count } = await GameCategory.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [
      [sortBy, order.toUpperCase()],
      ['id', 'ASC'],
    ],
  });
  return { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
}

const getById = (id) => findOrFail(id);

// Дубликаты имени ловит уникальный индекс БД -> UniqueConstraintError -> 409 в errorHandler
const create = (data, userId) =>
  sequelize.transaction(async (transaction) => {
    const category = await GameCategory.create(data, { fields: EDITABLE_FIELDS, transaction });
    await record(
      {
        userId,
        action: 'CREATE_CATEGORY',
        entityType: 'GameCategory',
        entityId: category.id,
        details: { name: category.name },
      },
      transaction
    );
    return category;
  });

async function replace(id, data, userId) {
  return sequelize.transaction(async (transaction) => {
    const category = await findOrFail(id, { transaction, lock: transaction.LOCK.UPDATE });
    await category.update(data, { fields: EDITABLE_FIELDS, transaction });
    await record(
      {
        userId,
        action: 'REPLACE_CATEGORY',
        entityType: 'GameCategory',
        entityId: id,
        details: { fields: Object.keys(data) },
      },
      transaction
    );
    return category;
  });
}

const update = replace;

// Бизнес-правило: категорию с продуктами удалять нельзя (409). Блокировка строки исключает гонку
// с одновременным назначением категории; последняя линия защиты - FK ON DELETE RESTRICT.
async function remove(id, userId) {
  await sequelize.transaction(async (transaction) => {
    const category = await findOrFail(id, { transaction, lock: transaction.LOCK.UPDATE });
    const productsCount = await Product.count({ where: { categoryId: id }, transaction });
    if (productsCount > 0) {
      throw new ConflictError(`Категория используется в играх (${productsCount}): удаление невозможно`);
    }
    await category.destroy({ transaction });
    await record(
      { userId, action: 'DELETE_CATEGORY', entityType: 'GameCategory', entityId: id, details: {} },
      transaction
    );
  });
}

module.exports = { list, getById, create, replace, update, remove };
