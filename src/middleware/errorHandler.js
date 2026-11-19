'use strict';

const {
  ValidationError: SequelizeValidationError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  DatabaseError,
  ConnectionError,
} = require('sequelize');
const env = require('../config/env');
const { AppError } = require('../errors/AppError');

// Какое поле нарушило уникальность: берём из err.fields или из имени ограничения (players_nickname_..., ...)
const UNIQUE_FIELDS = ['nickname', 'email', 'name'];
function uniqueDetails(err) {
  const fromFields = err.fields && typeof err.fields === 'object' ? Object.keys(err.fields) : [];
  const constraint = (err.parent && err.parent.constraint) || '';
  // Имя ограничения надёжнее err.fields: для индекса по lower(x) PostgreSQL сообщает выражение, а не колонку
  const guessed = UNIQUE_FIELDS.filter((f) => constraint.split('_').includes(f));
  const fields = guessed.length > 0 ? guessed : fromFields.filter((f) => /^[A-Za-z_]+$/.test(f));
  return fields.map((field) => ({ field, message: 'значение уже используется' }));
}

// Коды PostgreSQL: 23514 - CHECK, 23502 - NOT NULL, 22P02 - неверный формат, 22003 - число вне диапазона
const PG_VALIDATION_CODES = ['23514', '23502', '22P02', '22003', '22001'];

function normalize(err) {
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message, details: err.details };
  }
  if (err.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'Некорректный JSON в теле запроса' };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Слишком большое тело запроса' };
  }
  // Ошибки body-parser (например 415 charset.unsupported) уже несут корректный 4xx-статус
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500 && err.expose === true) {
    return { status: err.status, code: 'BAD_REQUEST', message: 'Некорректный запрос' };
  }
  if (err instanceof UniqueConstraintError) {
    const details = uniqueDetails(err);
    return {
      status: 409,
      code: 'CONFLICT',
      message: 'Запись с такими данными уже существует',
      details: details.length > 0 ? details : undefined,
    };
  }
  if (err instanceof ForeignKeyConstraintError) {
    return { status: 409, code: 'CONFLICT', message: 'Операция нарушает связи между записями' };
  }
  if (err instanceof SequelizeValidationError) {
    return {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Ошибка валидации',
      details: err.errors.map((e) => ({ field: e.path, message: e.message })),
    };
  }
  if (err instanceof DatabaseError && err.parent && PG_VALIDATION_CODES.includes(err.parent.code)) {
    return { status: 422, code: 'VALIDATION_ERROR', message: 'Данные нарушают ограничения базы данных' };
  }
  if (err instanceof ConnectionError) {
    return { status: 503, code: 'DATABASE_UNAVAILABLE', message: 'База данных недоступна' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' };
}

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  const { status, code, message, details } = normalize(err);

  if (status >= 500) console.error(err);

  const body = { error: { code, message } };
  if (details) body.error.details = details;
  if (status === 500 && !env.isProduction) body.error.stack = err.stack;

  res.status(status).json(body);
};
