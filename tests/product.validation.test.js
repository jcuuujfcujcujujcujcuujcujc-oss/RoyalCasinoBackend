'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCreate,
  validateReplace,
  validatePatch,
  validateListQuery,
  assertBetRange,
  parseId,
} = require('../src/modules/products/product.validation');

const valid = { name: ' Lucky Slots ', category: 'Slot', minBet: 0.1, maxBet: 100, rtp: 96.5 };

test('create: лишние поля отбрасываются (белый список), строки нормализуются', () => {
  const data = validateCreate({ ...valid, id: 100, isAdmin: true, createdAt: '2020-01-01' });
  assert.deepEqual(data, { name: 'Lucky Slots', category: 'slot', minBet: 0.1, maxBet: 100, rtp: 96.5 });
});

test('create: все обязательные поля перечисляются в ошибке', () => {
  assert.throws(() => validateCreate({}), (err) => {
    assert.equal(err.code, 'VALIDATION_ERROR');
    assert.deepEqual(err.details.map((d) => d.field).sort(), ['category', 'maxBet', 'minBet', 'name', 'rtp']);
    return true;
  });
});

test('create: неверные типы отклоняются', () => {
  assert.throws(() => validateCreate({ ...valid, minBet: '1' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateCreate({ ...valid, isActive: 'yes' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateCreate({ ...valid, tablesCount: 1.5 }), { code: 'VALIDATION_ERROR' });
});

test('create: диапазоны ставок, RTP и количества столов', () => {
  assert.throws(() => validateCreate({ ...valid, minBet: 0 }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateCreate({ ...valid, maxBet: 1000001 }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateCreate({ ...valid, rtp: 100.01 }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateCreate({ ...valid, rtp: -0.01 }), { code: 'VALIDATION_ERROR' });
  assert.doesNotThrow(() => validateCreate({ ...valid, rtp: 0 }));
  assert.doesNotThrow(() => validateCreate({ ...valid, rtp: 100 }));
  assert.throws(() => validateCreate({ ...valid, tablesCount: -1 }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateCreate({ ...valid, minBet: 0.123 }), { code: 'VALIDATION_ERROR' });
});

test('create: неизвестная категория отклоняется', () => {
  assert.throws(() => validateCreate({ ...valid, category: 'bingo' }), { code: 'VALIDATION_ERROR' });
});

test('create: minBet больше maxBet отклоняется', () => {
  assert.throws(() => validateCreate({ ...valid, minBet: 500, maxBet: 100 }), (err) => {
    assert.equal(err.code, 'VALIDATION_ERROR');
    assert.equal(err.details[0].field, 'maxBet');
    return true;
  });
});

test('replace: необязательные поля получают значения по умолчанию', () => {
  const data = validateReplace(valid);
  assert.equal(data.description, null);
  assert.equal(data.tablesCount, 0);
  assert.equal(data.isActive, true);
});

test('patch: пустой набор полей отклоняется, одно поле допустимо', () => {
  assert.throws(() => validatePatch({ id: 5 }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(validatePatch({ isActive: false }), { isActive: false });
});

test('patch: пара minBet/maxBet в одном запросе проверяется сразу', () => {
  assert.throws(() => validatePatch({ minBet: 50, maxBet: 10 }), { code: 'VALIDATION_ERROR' });
});

test('assertBetRange: равные границы допустимы', () => {
  assert.doesNotThrow(() => assertBetRange(5, 5));
  assert.throws(() => assertBetRange(6, 5), { code: 'VALIDATION_ERROR' });
});

test('parseId: допускает только положительные целые', () => {
  assert.equal(parseId('42'), 42);
  for (const bad of ['0', '-1', '1.5', 'abc', '99999999999']) {
    assert.throws(() => parseId(bad), { code: 'BAD_REQUEST' });
  }
});

test('list query: значения по умолчанию, фильтры и ошибки', () => {
  assert.deepEqual(validateListQuery({}), { page: 1, limit: 20, sortBy: 'id', order: 'asc', filters: {} });
  assert.deepEqual(validateListQuery({ category: 'slot', isActive: 'true' }).filters, {
    category: 'slot',
    isActive: true,
  });
  assert.throws(() => validateListQuery({ limit: '1000' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateListQuery({ sortBy: 'password' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateListQuery({ category: 'x' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateListQuery({ isActive: '1' }), { code: 'VALIDATION_ERROR' });
});

// ---- GameCategory: categoryId и обратная совместимость ----

const { legacyCategoryFor } = require('../src/modules/products/product.validation');

test('create: categoryId заменяет обязательное поле category', () => {
  const { category, ...noCategory } = { name: 'X', category: 'slot', minBet: 1, maxBet: 2, rtp: 90 };
  assert.equal(category, 'slot');
  assert.deepEqual(validateCreate({ ...noCategory, categoryId: 3 }), { ...noCategory, categoryId: 3 });
  // без category и без categoryId - по-прежнему ошибка по полю category
  assert.throws(() => validateCreate(noCategory), (err) => err.details.some((d) => d.field === 'category'));
  // categoryId: null не снимает требование category
  assert.throws(() => validateCreate({ ...noCategory, categoryId: null }), { code: 'VALIDATION_ERROR' });
});

test('categoryId: только положительное целое или null', () => {
  for (const bad of [0, -1, 1.5, '1', true, 2147483648]) {
    assert.throws(() => validatePatch({ categoryId: bad }), { code: 'VALIDATION_ERROR' }, String(bad));
  }
  assert.deepEqual(validatePatch({ categoryId: null }), { categoryId: null });
  assert.deepEqual(validatePatch({ categoryId: 7 }), { categoryId: 7 });
});

test('list query: фильтр categoryId', () => {
  assert.deepEqual(validateListQuery({ categoryId: '5' }).filters, { categoryId: 5 });
  for (const bad of ['0', 'abc', '-2', '1.5']) {
    assert.throws(() => validateListQuery({ categoryId: bad }), { code: 'VALIDATION_ERROR' });
  }
});

test('legacyCategoryFor: слаг из списка либо other', () => {
  assert.equal(legacyCategoryFor('Slot'), 'slot');
  assert.equal(legacyCategoryFor(' ROULETTE '), 'roulette');
  assert.equal(legacyCategoryFor('Lottery'), 'lottery');
  assert.equal(legacyCategoryFor('Bingo'), 'other');
});

// ---- PATCH: отрицательные и некорректные числа ----

test('patch: отрицательные и нечисловые значения отклоняются', () => {
  for (const body of [{ minBet: -5 }, { maxBet: -1 }, { rtp: -96 }, { tablesCount: -1 }, { maxBet: NaN }, { minBet: null }]) {
    assert.throws(() => validatePatch(body), { code: 'VALIDATION_ERROR' }, JSON.stringify(body));
  }
});

test('patch: mass assignment - id и служебные поля отбрасываются', () => {
  assert.deepEqual(validatePatch({ isActive: true, id: 9, createdAt: 'x', __proto__: { isAdmin: true } }), { isActive: true });
});

// ---- Casino game: provider, volatility, типы игр ----

test('игра: все 7 типов игр принимаются', () => {
  for (const category of ['slot', 'roulette', 'blackjack', 'poker', 'baccarat', 'dice', 'lottery']) {
    assert.equal(validateCreate({ ...valid, category }).category, category);
  }
});

test('игра: provider и volatility нормализуются и валидируются', () => {
  const data = validateCreate({ ...valid, provider: '  Royal Games ', volatility: 'high' });
  assert.equal(data.provider, 'Royal Games');
  assert.equal(data.volatility, 'HIGH');
  for (const volatility of ['EXTREME', '', 5, null]) {
    assert.throws(() => validateCreate({ ...valid, volatility }), { code: 'VALIDATION_ERROR' }, String(volatility));
  }
  for (const provider of ['', '   ', 'x'.repeat(101), 7, null]) {
    assert.throws(() => validateCreate({ ...valid, provider }), { code: 'VALIDATION_ERROR' }, String(provider));
  }
});

test('игра: provider и volatility необязательны при POST, PUT задаёт значения по умолчанию', () => {
  const created = validateCreate(valid);
  assert.equal('provider' in created, false);
  const replaced = validateReplace(valid);
  assert.equal(replaced.provider, 'Unknown');
  assert.equal(replaced.volatility, 'MEDIUM');
});

test('игра: фильтры provider и volatility в списке', () => {
  assert.deepEqual(validateListQuery({ provider: 'Royal Games', volatility: 'low' }).filters, {
    provider: 'Royal Games',
    volatility: 'LOW',
  });
  assert.throws(() => validateListQuery({ volatility: 'x' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateListQuery({ provider: '' }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(validateListQuery({ sortBy: 'provider' }).sortBy, 'provider');
});
