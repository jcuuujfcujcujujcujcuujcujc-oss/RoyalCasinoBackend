'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../src/modules/admin/admin.validation');

test('admin path id accepts only positive safe integers', () => {
  assert.equal(validation.parseId('12'), 12);
  for (const value of ['0', '-1', '1.2', '1e2', '9007199254740992']) {
    assert.throws(() => validation.parseId(value), { code: 'INVALID_ID' });
  }
});

test('admin role assignment accepts only distinct known role codes', () => {
  assert.deepEqual(validation.validateRoles({ roles: ['MANAGER', 'PLAYER'] }), ['MANAGER', 'PLAYER']);
  for (const body of [
    { roles: ['ADMIN', 'ADMIN'] },
    { roles: ['ROOT'] },
    { roles: ['PLAYER'], isActive: true },
    {},
  ]) {
    assert.throws(() => validation.validateRoles(body), { code: 'VALIDATION_ERROR' });
  }
});

test('audit pagination caps offset and date filters are validated', () => {
  assert.throws(() => validation.auditQuery({ page: '1000000', limit: '100' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validation.auditQuery({ from: 'yesterday' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validation.auditQuery({ from: '2026-12-31', to: '2026-01-01' }), {
    code: 'VALIDATION_ERROR',
  });
  assert.equal(validation.auditQuery({ from: '2026-01-01', to: '2026-12-31' }).limit, 20);
});
