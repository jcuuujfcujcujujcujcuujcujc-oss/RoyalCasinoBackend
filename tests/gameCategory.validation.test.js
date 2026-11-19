'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/modules/game-categories/gameCategory.validation');

test('create: name обязателен, строки обрезаются, лишние поля отбрасываются', () => {
  assert.deepEqual(v.validateCreate({ name: '  Slots ', id: 5, isAdmin: true }), { name: 'Slots' });
  assert.throws(
    () => v.validateCreate({}),
    (e) => e.code === 'VALIDATION_ERROR' && e.details[0].field === 'name'
  );
});

test('create: некорректные значения отклоняются', () => {
  for (const body of [
    { name: '' },
    { name: '   ' },
    { name: 5 },
    { name: 'x'.repeat(101) },
    { name: 'a', isActive: 'yes' },
    { name: 'a', description: 1 },
  ]) {
    assert.throws(() => v.validateCreate(body), { code: 'VALIDATION_ERROR' }, JSON.stringify(body));
  }
  assert.throws(() => v.validateCreate([]), { code: 'BAD_REQUEST' });
});

test('replace: значения по умолчанию; patch: минимум одно поле', () => {
  assert.deepEqual(v.validateReplace({ name: 'A' }), { name: 'A', description: null, isActive: true });
  assert.throws(() => v.validatePatch({}), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(v.validatePatch({ description: null }), { description: null });
});

test('list query и parseId', () => {
  assert.deepEqual(v.validateListQuery({ isActive: 'false', sortBy: 'name', order: 'desc' }), {
    page: 1,
    limit: 20,
    sortBy: 'name',
    order: 'desc',
    filters: { isActive: false },
  });
  assert.throws(() => v.validateListQuery({ sortBy: 'description' }), { code: 'VALIDATION_ERROR' });
  assert.equal(v.parseId('3'), 3);
  assert.throws(() => v.parseId('0'), { code: 'BAD_REQUEST' });
  assert.throws(() => v.parseId('1e3'), { code: 'BAD_REQUEST' });
});
