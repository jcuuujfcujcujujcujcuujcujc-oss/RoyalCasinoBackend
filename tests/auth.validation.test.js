'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateCredentials } = require('../src/modules/auth/auth.service');
const { AppError } = require('../src/errors/AppError');

test('регистрация нормализует email и принимает пароль в пределах bcrypt', () => {
  assert.equal(validateCredentials('  PLAYER@Example.test ', 'LongPassword123'), 'player@example.test');
});

test('регистрация отклоняет пароль длиннее лимита bcrypt в байтах', () => {
  assert.throws(
    () => validateCredentials('player@example.test', 'а'.repeat(37)),
    (error) => error instanceof AppError && error.statusCode === 422
  );
});

test('регистрация отклоняет короткий пароль и неверный email', () => {
  assert.throws(
    () => validateCredentials('not-an-email', 'LongPassword123'),
    (error) => error.statusCode === 422
  );
  assert.throws(
    () => validateCredentials('player@example.test', 'short'),
    (error) => error.statusCode === 422
  );
});
