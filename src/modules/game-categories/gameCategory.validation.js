'use strict';

const {
  validateFields: validateBySpec,
  requireAtLeastOneField,
  parseId,
  textValidator,
  booleanValidator,
  readPaging,
  readSorting,
  readBooleanFilter,
  finishQuery,
} = require('../../utils/validation');

const EDITABLE_FIELDS = ['name', 'description', 'isActive'];
const REQUIRED_ON_CREATE = ['name'];
const SORTABLE_FIELDS = ['id', 'name', 'createdAt'];

const validators = {
  name: textValidator({ min: 1, max: 100 }),
  description: textValidator({ max: 2000, nullable: true }),
  isActive: booleanValidator,
};

const validateFields = (body, required) => validateBySpec(body, { editable: EDITABLE_FIELDS, validators, required });

function validateCreate(body) {
  return validateFields(body, REQUIRED_ON_CREATE);
}

// PUT: полная замена; необязательные поля получают значения по умолчанию
function validateReplace(body) {
  const data = validateFields(body, REQUIRED_ON_CREATE);
  if (data.description === undefined) data.description = null;
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
    if (typeof query.search !== 'string' || query.search.trim().length < 1 || query.search.trim().length > 100) details.push({ field: 'search', message: 'длина от 1 до 100 символов' });
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
