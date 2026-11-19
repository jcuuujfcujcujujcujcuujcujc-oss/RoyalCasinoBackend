'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateAdjustment,
  validateHistoryQuery,
} = require('../src/modules/player-credits/credit.validation');
const { parseAmount } = require('../src/modules/player-credits/credit.service');

test('adjustment requires decimal string and idempotency key; rejects mass assignment', () => {
  assert.deepEqual(validateAdjustment({ amount: '-10.25' }, 'adjust-0001'), {
    amount: '-10.25',
    idempotencyKey: 'adjust-0001',
  });
  assert.throws(() => validateAdjustment({ amount: 1 }, 'adjust-0001'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateAdjustment({ amount: '1', balance: '999999' }, 'adjust-0001'), {
    code: 'VALIDATION_ERROR',
  });
  assert.throws(() => validateAdjustment({ amount: '1' }, ''), { code: 'IDEMPOTENCY_KEY_REQUIRED' });
});

test('credit amount arithmetic uses exact integer cents and validates bounds', () => {
  assert.equal(parseAmount('100000000000.01'), 10000000000001n);
  assert.equal(parseAmount('-0.09'), -9n);
  assert.throws(() => parseAmount('0.001'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => parseAmount('0.00'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => parseAmount(0.1), { code: 'VALIDATION_ERROR' });
});

test('credit history paging is bounded', () => {
  assert.deepEqual(validateHistoryQuery({ page: '2', limit: '10' }), { page: 2, limit: 10 });
  assert.throws(() => validateHistoryQuery({ limit: '101' }), { code: 'VALIDATION_ERROR' });
});
