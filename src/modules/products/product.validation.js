'use strict';

const { ValidationError } = require('../../errors/AppError');
const {
  validateFields: validateBySpec,
  requireAtLeastOneField,
  ensureObject,
  parseId,
  textValidator,
  readPaging,
  readSorting,
  readBooleanFilter,
  readIdFilter,
  finishQuery,
  MAX_INT,
} = require('../../utils/validation');

// Игровой продукт казино: слот, рулетка, блэкджек и т.д. Ставки - в виртуальных кредитах.
const CATEGORIES = ['slot', 'roulette', 'blackjack', 'poker', 'baccarat', 'dice', 'lottery', 'other'];

// Волатильность игры (контролируемый набор)
const VOLATILITIES = ['LOW', 'MEDIUM', 'HIGH'];

// Белый список полей, разрешённых к записи клиентом (id, createdAt и т.д. сюда не попадут)
const EDITABLE_FIELDS = [
  'name',
  'description',
  'category',
  'provider',
  'categoryId',
  'volatility',
  'minBet',
  'maxBet',
  'rtp',
  'tablesCount',
  'isActive',
];
const REQUIRED_ON_CREATE = ['name', 'category', 'minBet', 'maxBet', 'rtp'];

const SORTABLE_FIELDS = ['id', 'name', 'provider', 'volatility', 'category', 'categoryId', 'provider', 'volatility', 'minBet', 'maxBet', 'rtp', 'createdAt'];

const DEFAULT_PROVIDER = 'Unknown';
const MIN_BET = 0.01;
const MAX_BET = 1000000;
const MIN_RTP = 0; // RTP (Return To Player) в процентах, допустимый диапазон 0..100
const MAX_RTP = 100;
const MAX_TABLES = 1000;

const hasMaxTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'должно быть числом' };
  if (value < MIN_BET || value > MAX_BET) return { error: `должно быть в диапазоне ${MIN_BET}..${MAX_BET}` };
  if (!hasMaxTwoDecimals(value)) return { error: 'допускается не более 2 знаков после запятой' };
  return { value };
}

const validators = {
  name(value) {
    if (typeof value !== 'string') return { error: 'должно быть строкой' };
    const trimmed = value.trim();
    if (trimmed.length === 0) return { error: 'не может быть пустым' };
    if (trimmed.length > 255) return { error: 'не длиннее 255 символов' };
    return { value: trimmed };
  },
  description(value) {
    if (value === null) return { value: null };
    if (typeof value !== 'string') return { error: 'должно быть строкой или null' };
    if (value.length > 2000) return { error: 'не длиннее 2000 символов' };
    return { value: value.trim() };
  },
  category(value) {
    if (typeof value !== 'string') return { error: 'должно быть строкой' };
    const normalized = value.trim().toLowerCase();
    if (!CATEGORIES.includes(normalized)) return { error: `допустимо: ${CATEGORIES.join(', ')}` };
    return { value: normalized };
  },
  // Ссылка на GameCategory; null = без связи (устаревшая строка category остаётся)
  categoryId(value) {
    if (value === null) return { value: null };
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_INT) {
      return { error: 'должно быть положительным целым числом или null' };
    }
    return { value };
  },
  provider: textValidator({ min: 1, max: 100 }),
  volatility(value) {
    if (typeof value !== 'string') return { error: 'должно быть строкой' };
    const normalized = value.trim().toUpperCase();
    if (!VOLATILITIES.includes(normalized)) return { error: `допустимо: ${VOLATILITIES.join(', ')}` };
    return { value: normalized };
  },
  minBet: money,
  maxBet: money,
  rtp(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'должно быть числом' };
    if (value < MIN_RTP || value > MAX_RTP) return { error: `должно быть в диапазоне ${MIN_RTP}..${MAX_RTP}` };
    if (!hasMaxTwoDecimals(value)) return { error: 'допускается не более 2 знаков после запятой' };
    return { value };
  },
  tablesCount(value) {
    if (typeof value !== 'number' || !Number.isInteger(value)) return { error: 'должно быть целым числом' };
    if (value < 0 || value > MAX_TABLES) return { error: `должно быть в диапазоне 0..${MAX_TABLES}` };
    return { value };
  },
  isActive(value) {
    if (typeof value !== 'boolean') return { error: 'должно быть true или false' };
    return { value };
  },
};

const validateFields = (body, required) =>
  validateBySpec(body, { editable: EDITABLE_FIELDS, validators, required });

// Устаревшее строковое поле category, выводимое из имени GameCategory: слаг из списка или 'other'
function legacyCategoryFor(categoryName) {
  const normalized = String(categoryName).trim().toLowerCase();
  return CATEGORIES.includes(normalized) ? normalized : 'other';
}

// category обязательно, только если не передан categoryId (обратная совместимость API)
function requiredOnCreate(body) {
  ensureObject(body);
  const hasCategoryId = body.categoryId !== undefined && body.categoryId !== null;
  return hasCategoryId ? REQUIRED_ON_CREATE.filter((f) => f !== 'category') : REQUIRED_ON_CREATE;
}

// Межполевое правило: минимальная ставка не может превышать максимальную
function assertBetRange(minBet, maxBet) {
  if (minBet > maxBet) {
    throw new ValidationError([{ field: 'maxBet', message: 'не может быть меньше minBet' }]);
  }
}

// POST: name, category, minBet, maxBet, rtp обязательны
function validateCreate(body) {
  const data = validateFields(body, requiredOnCreate(body));
  assertBetRange(data.minBet, data.maxBet);
  return data;
}

// PUT: полная замена; необязательные поля, которых нет в теле, получают значения по умолчанию
function validateReplace(body) {
  const data = validateFields(body, requiredOnCreate(body));
  assertBetRange(data.minBet, data.maxBet);
  if (data.description === undefined) data.description = null;
  if (data.tablesCount === undefined) data.tablesCount = 0;
  if (data.provider === undefined) data.provider = DEFAULT_PROVIDER;
  if (data.volatility === undefined) data.volatility = 'MEDIUM';
  if (data.isActive === undefined) data.isActive = true;
  return data;
}

// PATCH: любые разрешённые поля, но хотя бы одно. Правило minBet <= maxBet для частичных
// обновлений проверяется в сервисе, где известны текущие значения записи.
function validatePatch(body) {
  const data = validateFields(body, []);
  requireAtLeastOneField(data, EDITABLE_FIELDS);
  if (data.minBet !== undefined && data.maxBet !== undefined) assertBetRange(data.minBet, data.maxBet);
  return data;
}

function validateListQuery(query = {}) {
  const details = [];
  const { page, limit } = readPaging(query, details);
  const { sortBy, order } = readSorting(query, SORTABLE_FIELDS, details);

  const filters = {};
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.trim().length < 1 || query.search.trim().length > 100) details.push({ field: 'search', message: 'длина от 1 до 100 символов' });
    else filters.search = query.search.trim();
  }
  if (query.category !== undefined) {
    if (typeof query.category === 'string' && CATEGORIES.includes(query.category)) {
      filters.category = query.category;
    } else {
      details.push({ field: 'category', message: `допустимо: ${CATEGORIES.join(', ')}` });
    }
  }
  readIdFilter(query, 'categoryId', filters, details);
  if (query.provider !== undefined) {
    const result = validators.provider(query.provider);
    if (result.error) details.push({ field: 'provider', message: result.error });
    else filters.provider = result.value;
  }
  if (query.volatility !== undefined) {
    const result = validators.volatility(query.volatility);
    if (result.error) details.push({ field: 'volatility', message: result.error });
    else filters.volatility = result.value;
  }
  readBooleanFilter(query, 'isActive', filters, details);

  return finishQuery(details, { page, limit, sortBy, order, filters });
}

module.exports = {
  CATEGORIES,
  VOLATILITIES,
  EDITABLE_FIELDS,
  assertBetRange,
  legacyCategoryFor,
  validateCreate,
  validateReplace,
  validatePatch,
  validateListQuery,
  parseId,
};
