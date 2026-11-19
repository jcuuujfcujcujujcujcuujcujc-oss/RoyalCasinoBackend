'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connect, reset, startServer, client } = require('../helpers/db');

let ctx;
let srv;
let admin;

before(async () => {
  ctx = await connect();
  if (!ctx.ok) return;
  srv = await startServer();
  admin = client(srv.baseUrl, ctx.token);
});
after(async () => {
  if (srv) await new Promise((resolve) => srv.server.close(resolve));
  if (ctx?.ok) await ctx.sequelize.close();
});
beforeEach(async () => {
  if (ctx?.ok) await reset(ctx.sequelize);
});

test('MANAGER can read any player and virtual credit history but cannot adjust credits or mutate another player', async (t) => {
  if (!ctx?.ok) {
    t.skip(ctx?.reason || 'PostgreSQL *_test недоступна');
    return;
  }
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const created = await admin('POST', '/api/players', {
    nickname: `Target${suffix}`,
    email: `target-${suffix}@example.test`,
  });
  assert.equal(created.status, 201);
  const { User, Role, UserRole } = require('../../src/models');
  const managerUser = await User.create({
    email: `manager-${suffix}@example.test`,
    passwordHash: await bcrypt.hash('not-used-by-test', 10),
  });
  const managerRole = await Role.findOne({ where: { code: 'MANAGER' } });
  await UserRole.create({ userId: managerUser.id, roleId: managerRole.id });
  const token = jwt.sign({ sub: String(managerUser.id) }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'royal-casino-backend',
    audience: 'royal-casino-api',
    expiresIn: '15m',
  });
  const manager = client(srv.baseUrl, token);
  const id = created.body.data.id;

  assert.equal((await manager('GET', '/api/players')).status, 200);
  assert.equal((await manager('GET', `/api/players/${id}`)).status, 200);
  assert.equal((await manager('GET', `/api/players/${id}/credits`)).status, 200);
  assert.equal((await manager('GET', `/api/players/${id}/credits/transactions`)).status, 200);
  assert.equal((await manager('PATCH', `/api/players/${id}`, { nickname: `Changed${suffix}` })).status, 404);
  assert.equal(
    (
      await manager(
        'POST',
        `/api/players/${id}/credits/adjustments`,
        { amount: '1.00' },
        {
          'Idempotency-Key': `manager-${suffix}`,
        }
      )
    ).status,
    403
  );
});
