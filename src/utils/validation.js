'use strict';

// Общие строительные блоки валидации для всех модулей (products, game-categories, players).
// Вынесены из product.validation.js, чтобы не дублировать код в новых модулях.

const { BadRequestError, ValidationError } = require('../errors/AppError');

const MAX_INT = 2147483647;

function ensureObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('Тело запроса должно быть JSON-объектом');
  }
}

function parseId(raw) {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > MAX_INT) {
    throw new BadRequestError('id должен быть положительным целым числом');
  }
  return Number(raw);
}

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// Проверка тела запроса по белому списку полей. Неизвестные поля молча отбрасываются.
// validators[field](value) -> { value } | { error }
function validateFields(body, { editable, validators, required = [] }) {
  ensureObject(body);
  const data = {};
  const details = [];

  for (const field of editable) {
    if (!hasOwn(body, field) || body[field] === undefined) {
      if (required.includes(field)) details.push({ field, message: 'обязательное поле' });
      continue;
    }
    const result = validators[field](body[field]);
    if (result.error) details.push({ field, message: result.error });
    else data[field] = result.value;
  }

  if (details.length > 0) throw new ValidationError(details);
  return data;
}

function requireAtLeastOneField(data, editable) {
  if (Object.keys(data).length === 0) {
    throw new ValidationError(
      [{ field: '*', message: `укажите хотя бы одно поле: ${editable.join(', ')}` }],
      'Нет полей для обновления'
    );
  }
}

const positiveIntValidator = (value) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_INT
    ? { value }
    : { error: 'должно быть положительным целым числом' };

const booleanValidator = (value) =>
  typeof value === 'boolean' ? { value } : { error: 'должно быть true или false' };

// Строка с обрезкой пробелов; nullable=true разрешает null
function textValidator({ min = 0, max, nullable = false }) {
  return (value) => {
    if (value === null && nullable) return { value: null };
    if (typeof value !== 'string')
      return { error: nullable ? 'должно быть строкой или null' : 'должно быть строкой' };
    const trimmed = value.trim();
    if (trimmed.length < min)
      return { error: min === 1 ? 'не может быть пустым' : `не короче ${min} символов` };
    if (trimmed.length > max) return { error: `не длиннее ${max} символов` };
    return { value: trimmed };
  };
}

// ---- query-параметры списков ----

function readPaging(query, details) {
  const readInt = (name, fallback, min, max) => {
    const raw = query[name];
    if (raw === undefined) return fallback;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
      details.push({ field: name, message: `должно быть целым числом в диапазоне ${min}..${max}` });
      return fallback;
    }
    return Number(raw);
  };
  const page = readInt('page', 1, 1, 1000000);
  const limit = readInt('limit', 20, 1, 100);
  if ((page - 1) * limit > 1000000)
    details.push({ field: 'page', message: 'смещение страницы не должно превышать 1000000 записей' });
  return { page, limit };
}

function readSorting(query, sortable, details) {
  let sortBy = 'id';
  if (query.sortBy !== undefined) {
    if (sortable.includes(query.sortBy)) sortBy = query.sortBy;
    else details.push({ field: 'sortBy', message: `допустимо: ${sortable.join(', ')}` });
  }
  let order = 'asc';
  if (query.order !== undefined) {
    if (['asc', 'desc'].includes(query.order)) order = query.order;
    else details.push({ field: 'order', message: 'допустимо: asc, desc' });
  }
  return { sortBy, order };
}

function readBooleanFilter(query, name, filters, details) {
  if (query[name] === undefined) return;
  if (query[name] === 'true' || query[name] === 'false') filters[name] = query[name] === 'true';
  else details.push({ field: name, message: 'допустимо: true, false' });
}

function readIdFilter(query, name, filters, details) {
  if (query[name] === undefined) return;
  const raw = query[name];
  if (typeof raw === 'string' && /^[1-9]\d{0,9}$/.test(raw) && Number(raw) <= MAX_INT)
    filters[name] = Number(raw);
  else details.push({ field: name, message: 'должно быть положительным целым числом' });
}

function finishQuery(details, result) {
  if (details.length > 0) throw new ValidationError(details, 'Некорректные параметры запроса');
  return result;
}

module.exports = {
  MAX_INT,
  ensureObject,
  parseId,
  validateFields,
  requireAtLeastOneField,
  positiveIntValidator,
  booleanValidator,
  textValidator,
  readPaging,
  readSorting,
  readBooleanFilter,
  readIdFilter,
  finishQuery,
};
