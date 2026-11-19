'use strict';

// Требует установленных зависимостей (sequelize), БД не нужна.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UniqueConstraintError, ForeignKeyConstraintError, DatabaseError } = require('sequelize');
const errorHandler = require('../src/middleware/errorHandler');

function run(err) {
  const out = {};
  const res = { status(s) { out.status = s; return this; }, json(b) { out.body = b; return this; } };
  errorHandler(err, {}, res, () => {});
  return out;
}

const pgError = (code, extra = {}) => Object.assign(new Error('pg'), { code, ...extra });

test('нарушение CHECK (23514) -> 422, а не 500', () => {
  const { status, body } = run(new DatabaseError(pgError('23514')));
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('нарушение внешнего ключа -> 409', () => {
  const { status } = run(new ForeignKeyConstraintError({ parent: pgError('23503') }));
  assert.equal(status, 409);
});

test('unique: поле определяется по имени ограничения (индекс по lower(nickname))', () => {
  const parent = pgError('23505', { constraint: 'players_nickname_lower_uidx' });
  const { status, body } = run(new UniqueConstraintError({ parent, fields: { 'lower(nickname::text)': 'alice' } }));
  assert.equal(status, 409);
  assert.deepEqual(body.error.details, [{ field: 'nickname', message: 'значение уже используется' }]);
});

test('4xx от body-parser (415 charset.unsupported) сохраняет статус', () => {
  const err = Object.assign(new Error('unsupported charset'), { status: 415, expose: true, type: 'charset.unsupported' });
  assert.equal(run(err).status, 415);
});

test('неизвестная ошибка -> 500 без утечки деталей в production-формате', () => {
  const { status, body } = run(new Error('boom'));
  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
});
