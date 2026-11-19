'use strict';

const { AppError } = require('../../errors/AppError');
const { readPaging, finishQuery } = require('../../utils/validation');

function validateAdjustment(body, idempotencyKey) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new AppError(400, 'Ожидается JSON-объект', 'BAD_REQUEST');
  if (Object.keys(body).some((field) => field !== 'amount'))
    throw new AppError(422, 'Допустимое поле: amount', 'VALIDATION_ERROR');
  if (typeof body.amount !== 'string' || !/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(body.amount))
    throw new AppError(422, 'amount передавайте строкой с точностью до 2 знаков', 'VALIDATION_ERROR');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey))
    throw new AppError(400, 'Требуется корректный заголовок Idempotency-Key', 'IDEMPOTENCY_KEY_REQUIRED');
  return { amount: body.amount, idempotencyKey };
}

function validateHistoryQuery(query) {
  const details = [];
  const paging = readPaging(query, details);
  return finishQuery(details, paging);
}

module.exports = { validateAdjustment, validateHistoryQuery };
