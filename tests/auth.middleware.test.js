'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ownerOrStaff, ownerOrSelf, preventOwnStatusChange } = require('../src/modules/auth/auth.middleware');

function invoke(middleware, req) {
  let error;
  let nextCalled = false;
  middleware(req, {}, (value) => {
    error = value;
    nextCalled = true;
  });
  return { error, nextCalled };
}

test('MANAGER can read arbitrary player records while PLAYER is limited to owner', () => {
  const manager = invoke(ownerOrStaff, {
    auth: { roles: ['MANAGER'], playerId: null },
    params: { id: '42' },
  });
  assert.equal(manager.nextCalled, true);
  assert.equal(manager.error, undefined);
  const stranger = invoke(ownerOrStaff, { auth: { roles: ['PLAYER'], playerId: 7 }, params: { id: '42' } });
  assert.equal(stranger.error.code, 'NOT_FOUND');
  const owner = invoke(ownerOrStaff, { auth: { roles: ['PLAYER'], playerId: 42 }, params: { id: '42' } });
  assert.equal(owner.nextCalled, true);
});

test('only ADMIN or owner can PATCH; non-admin cannot change active status', () => {
  const managerOther = invoke(ownerOrSelf, {
    auth: { roles: ['MANAGER'], playerId: 7 },
    params: { id: '42' },
  });
  assert.equal(managerOther.error.code, 'NOT_FOUND');
  const admin = invoke(ownerOrSelf, { auth: { roles: ['ADMIN'], playerId: null }, params: { id: '42' } });
  assert.equal(admin.nextCalled, true);
  const status = invoke(preventOwnStatusChange, { auth: { roles: ['PLAYER'] }, body: { isActive: false } });
  assert.equal(status.error.code, 'FORBIDDEN');
});
