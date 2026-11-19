'use strict';

const {
  validateFields: validateBySpec,
  requireAtLeastOneField,
  parseId,
  booleanValidator,
  readPaging,
  readSorting,
  readBooleanFilter,
  finishQuery,
} = require('../../utils/validation');

const EDITABLE_FIELDS = ['nickname', 'email', 'isActive'];
const REQUIRED_ON_CREATE = ['nickname', 'email'];
const SORTABLE_FIELDS = ['id', 'nickname', 'email', 'createdAt'];

const NICKNAME_RE = /^[A-Za-z0-9_.-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const validators = {
  nickname(value) {
    if (typeof value !== 'string') return { error: 'должно быть строкой' };
    const trimmed = value.trim();
    if (trimmed.length < 3 || trimmed.length > 30) return { error: 'длина от 3 до 30 символов' };
    if (!NICKNAME_RE.test(trimmed)) return { error: 'допустимы латинские буквы, цифры, ".", "_" и "-"' };
    return { value: trimmed };
  },
  // Email хранится в нижнем регистре, чтобы уникальность не зависела от регистра
  email(value) {
    if (typeof value !== 'string') return { error: 'должно быть строкой' };
    const normalized = value.trim().toLowerCase();
    const [local = ''] = normalized.split('@');
    if (normalized.length > 254 || local.length > 64 || !EMAIL_RE.test(normalized)) {
      return { error: 'некорректный email' };
    }
    return { value: normalized };
  },
  isActive: booleanValidator,
};

const validateFields = (body, required) =>
  validateBySpec(body, { editable: EDITABLE_FIELDS, validators, required });

const validateCreate = (body) => validateFields(body, REQUIRED_ON_CREATE);

function validateReplace(body) {
  const data = validateFields(body, REQUIRED_ON_CREATE);
  if (data.isActive === undefined) data.isActive = true;
  return data;
}

function validatePatch(body) {
  const data = validateFields(body, []);
  requireAtLeastOneField(data, EDITABLE_FIELDS);
  return data;
}

function validateListQuery(query = {}) {
  const details = [];
  const { page, limit } = readPaging(query, details);
  const { sortBy, order } = readSorting(query, SORTABLE_FIELDS, details);
  const filters = {};
  if (query.search !== undefined) {
    if (
      typeof query.search !== 'string' ||
      query.search.trim().length < 1 ||
      query.search.trim().length > 100
    )
      details.push({ field: 'search', message: 'длина от 1 до 100 символов' });
    else filters.search = query.search.trim();
  }
  readBooleanFilter(query, 'isActive', filters, details);
  return finishQuery(details, { page, limit, sortBy, order, filters });
}

module.exports = {
  EDITABLE_FIELDS,
  validateCreate,
  validateReplace,
  validatePatch,
  validateListQuery,
  parseId,
};
