'use strict';

const { Product, GameCategory, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { NotFoundError, ValidationError } = require('../../errors/AppError');
const { EDITABLE_FIELDS, assertBetRange, legacyCategoryFor } = require('./product.validation');
const { record } = require('../audit/audit.service');

async function findOrFail(id, options = {}) {
  const product = await Product.findByPk(id, options);
  if (!product) throw new NotFoundError(`Игровой продукт с id=${id} не найден`);
  return product;
}

// Согласует устаревшую строку category и ссылку categoryId (обратная совместимость API):
//  - передан categoryId  -> категория должна существовать; category выводится из её имени
//                           (если клиент прислал и category - оно должно совпадать);
//  - передан только category -> categoryId подбирается по имени категории без учёта регистра (или null);
//  - categoryId: null    -> связь снимается, category остаётся как есть.
async function applyCategory(data, transaction) {
  const result = { ...data };

  if (result.categoryId !== undefined && result.categoryId !== null) {
    const category = await GameCategory.findByPk(result.categoryId, { transaction });
    if (!category) throw new ValidationError([{ field: 'categoryId', message: 'категория не существует' }]);
    const legacy = legacyCategoryFor(category.name);
    if (result.category !== undefined && result.category !== legacy) {
      throw new ValidationError([
        { field: 'category', message: `не соответствует categoryId (для этой категории: '${legacy}')` },
      ]);
    }
    result.category = legacy;
  } else if (result.categoryId === undefined && result.category !== undefined) {
    const match = await GameCategory.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), result.category),
      transaction,
    });
    result.categoryId = match ? match.id : null;
  }
  return result;
}

// Фильтр по провайдеру не зависит от регистра; остальные фильтры - точное совпадение
function buildWhere({ provider, search, ...rest }) {
  const where = { ...rest };
  if (search !== undefined) where[Op.or] = ['name', 'description', 'provider'].map((field) => ({ [field]: { [Op.iLike]: `%${search.replace(/[\\%_]/g, '\\$&')}%` } }));
  if (provider !== undefined) {
    where[Op.and] = [sequelize.where(sequelize.fn('lower', sequelize.col('provider')), provider.toLowerCase())];
  }
  return where;
}

async function list({ page, limit, sortBy, order, filters }) {
  const { rows, count } = await Product.findAndCountAll({
    where: buildWhere(filters),
    limit,
    offset: (page - 1) * limit,
    order: [[sortBy, order.toUpperCase()], ['id', 'ASC']],
  });
  return {
    data: rows,
    meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  };
}

function getById(id) {
  return findOrFail(id);
}

function create(data, userId) {
  return sequelize.transaction(async (transaction) => {
    const prepared = await applyCategory(data, transaction);
    // fields - второй уровень защиты от mass assignment
    const product = await Product.create(prepared, { fields: EDITABLE_FIELDS, transaction });
    await record({ userId, action: 'CREATE_GAME', entityType: 'Product', entityId: product.id, details: { name: product.name } }, transaction);
    return product;
  });
}

function replace(id, data, userId) {
  return sequelize.transaction(async (transaction) => {
    const product = await findOrFail(id, { transaction, lock: transaction.LOCK.UPDATE });
    const prepared = await applyCategory(data, transaction);
    await product.update(prepared, { fields: EDITABLE_FIELDS, transaction });
    await record({ userId, action: 'REPLACE_GAME', entityType: 'Product', entityId: id, details: { fields: Object.keys(prepared) } }, transaction);
    return product;
  });
}

// PATCH: итоговая пара ставок = новые значения + текущие из БД. Строка блокируется (FOR UPDATE),
// иначе два параллельных PATCH (minBet и maxBet) оба проходят проверку и нарушают CHECK в БД.
function update(id, data, userId) {
  return sequelize.transaction(async (transaction) => {
    const product = await findOrFail(id, { transaction, lock: transaction.LOCK.UPDATE });
    assertBetRange(data.minBet ?? product.minBet, data.maxBet ?? product.maxBet);
    const prepared = await applyCategory(data, transaction);
    await product.update(prepared, { fields: EDITABLE_FIELDS, transaction });
    await record({ userId, action: 'UPDATE_GAME', entityType: 'Product', entityId: id, details: { fields: Object.keys(prepared) } }, transaction);
    return product;
  });
}

async function remove(id, userId) {
  await sequelize.transaction(async (transaction) => {
    const product = await findOrFail(id, { transaction, lock: transaction.LOCK.UPDATE });
    await product.destroy({ transaction });
    await record({ userId, action: 'DELETE_GAME', entityType: 'Product', entityId: id, details: {} }, transaction);
  });
}

module.exports = { list, getById, create, replace, update, remove };
