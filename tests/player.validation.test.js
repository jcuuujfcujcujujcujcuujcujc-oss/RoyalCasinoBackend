'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/modules/players/player.validation');

test('create: nickname и email обязательны, email приводится к нижнему регистру', () => {
  assert.deepEqual(v.validateCreate({ nickname: ' Neo_1 ', email: ' Neo@Matrix.IO ', id: 1 }), {
    nickname: 'Neo_1',
    email: 'neo@matrix.io',
  });
  assert.throws(() => v.validateCreate({}), (e) => e.details.map((d) => d.field).join() === 'nickname,email');
});

test('nickname: длина и допустимые символы', () => {
  for (const nickname of ['ab', 'x'.repeat(31), 'bad nick', 'ник', 'a<b>c', 5]) {
    assert.throws(() => v.validateCreate({ nickname, email: 'a@b.cc' }), { code: 'VALIDATION_ERROR' }, String(nickname));
  }
  assert.doesNotThrow(() => v.validateCreate({ nickname: 'abc', email: 'a@b.cc' }));
});

test('email: некорректные адреса отклоняются', () => {
  for (const email of ['', 'plain', 'a@b', 'a b@c.io', '@c.io', 'a@@c.io', `${'x'.repeat(65)}@c.io`, 7, null]) {
    assert.throws(() => v.validateCreate({ nickname: 'abc', email }), { code: 'VALIDATION_ERROR' }, String(email));
  }
});

test('replace/patch/list/parseId', () => {
  assert.deepEqual(v.validateReplace({ nickname: 'abc', email: 'a@b.cc' }), { nickname: 'abc', email: 'a@b.cc', isActive: true });
  assert.throws(() => v.validateReplace({ nickname: 'abc' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => v.validatePatch({ unknown: 1 }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(v.validatePatch({ isActive: false }), { isActive: false });
  assert.deepEqual(v.validateListQuery({ limit: '5' }).limit, 5);
  assert.throws(() => v.validateListQuery({ limit: '0' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => v.parseId('-1'), { code: 'BAD_REQUEST' });
});
