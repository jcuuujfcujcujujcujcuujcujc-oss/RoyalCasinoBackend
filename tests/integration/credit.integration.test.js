'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { connect, reset, startServer, client } = require('../helpers/db');

let ctx;
let srv;
let api;
let admin;

before(async () => {
  ctx = await connect();
  if (!ctx.ok) return;
  srv = await startServer();
  api = client(srv.baseUrl);
  admin = client(srv.baseUrl, ctx.token);
});
after(async () => {
  if (srv) await new Promise((resolve) => srv.server.close(resolve));
  if (ctx?.ok) await ctx.sequelize.close();
});
beforeEach(async () => {
  if (ctx?.ok) await reset(ctx.sequelize);
});

const guard = (t) => {
  if (!ctx?.ok) {
    t.skip(ctx?.reason || 'PostgreSQL *_test недоступна');
    return false;
  }
  return true;
};

test('credit adjustments are idempotent, non-negative, immutable, and conserved in ledger', async (t) => {
  if (!guard(t)) return;
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const registered = await api('POST', '/api/auth/register', {
    email: `ledger-${suffix}@example.test`,
    password: 'StrongPassword123!',
    nickname: `C${suffix}`,
  });
  assert.equal(registered.status, 201);
  const { Player } = require('../../src/models');
  const player = await Player.findOne({ where: { userId: registered.body.data.user.id } });
  assert.ok(player);
  const playerApi = client(srv.baseUrl, registered.body.data.accessToken);

  const initialHistory = await playerApi('GET', `/api/players/${player.id}/credits/transactions`);
  assert.equal(initialHistory.status, 200);
  assert.equal(initialHistory.body.data[0].type, 'GRANT');
  assert.equal(initialHistory.body.data[0].amount, '1000.00');
  assert.equal(
    (await playerApi('POST', `/api/players/${player.id}/credits/adjustments`, { amount: '-1.00' })).status,
    403
  );

  const key = `adjust-${suffix}`;
  const path = `/api/players/${player.id}/credits/adjustments`;
  const first = await admin('POST', path, { amount: '-100.00' }, { 'Idempotency-Key': key });
  const replay = await admin('POST', path, { amount: '-100.00' }, { 'Idempotency-Key': key });
  assert.equal(first.status, 200);
  assert.equal(replay.body.data.id, first.body.data.id);
  assert.equal(first.body.data.amount, '-100.00');
  assert.equal(first.body.data.balanceAfter, '900.00');
  assert.equal((await admin('POST', path, { amount: '-99.00' }, { 'Idempotency-Key': key })).status, 409);

  const parallelKey = `parallel-${suffix}`;
  const sameKey = await Promise.all([
    admin('POST', path, { amount: '1.25' }, { 'Idempotency-Key': parallelKey }),
    admin('POST', path, { amount: '1.25' }, { 'Idempotency-Key': parallelKey }),
  ]);
  assert.equal(sameKey[0].status, 200);
  assert.equal(sameKey[1].status, 200);
  assert.equal(sameKey[0].body.data.id, sameKey[1].body.data.id);

  const concurrent = await Promise.all([
    admin('POST', path, { amount: '-700.00' }, { 'Idempotency-Key': `debit-a-${suffix}` }),
    admin('POST', path, { amount: '-700.00' }, { 'Idempotency-Key': `debit-b-${suffix}` }),
  ]);
  assert.deepEqual(concurrent.map((item) => item.status).sort(), [200, 422]);
  const { PlayerCreditProfile } = require('../../src/models');
  const profile = await PlayerCreditProfile.findOne({ where: { playerId: player.id } });
  const [{ balance }] = await ctx.sequelize.query(
    'SELECT COALESCE(SUM(amount), 0)::numeric(14,2) AS balance FROM credit_transactions WHERE player_id = :playerId',
    { replacements: { playerId: player.id }, type: ctx.sequelize.QueryTypes.SELECT }
  );
  assert.equal(profile.balance, balance);
  await assert.rejects(
    ctx.sequelize.query('UPDATE credit_transactions SET amount = 0 WHERE player_id = :playerId', {
      replacements: { playerId: player.id },
    })
  );
});
