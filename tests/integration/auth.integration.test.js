'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { connect, reset, startServer, client } = require('../helpers/db');
let ctx;
let srv;
let api;

before(async () => {
  ctx = await connect();
  if (!ctx.ok) return;
  srv = await startServer();
  api = client(srv.baseUrl);
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

test('регистрация создаёт PLAYER, игрока и виртуальный профиль без возврата passwordHash', async (t) => {
  if (!guard(t)) return;
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const password = 'StrongPassword123!';
  const result = await api('POST', '/api/auth/register', {
    email: `auth-${suffix}@example.test`,
    password,
    nickname: `P${suffix}`,
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.user.roles[0], 'PLAYER');
  assert.ok(result.body.data.accessToken);
  assert.ok(result.body.data.refreshToken);
  assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
  const { User, Player, PlayerCreditProfile, RefreshToken } = require('../../src/models');
  const user = await User.unscoped().findByPk(result.body.data.user.id);
  assert.notEqual(user.passwordHash, password);
  const player = await Player.findOne({ where: { userId: user.id } });
  assert.ok(player);
  const credit = await PlayerCreditProfile.findOne({ where: { playerId: player.id } });
  assert.equal(Number(credit.balance), 1000);
  const stored = await RefreshToken.findOne({ where: { userId: user.id } });
  assert.notEqual(stored.tokenHash, result.body.data.refreshToken);
  assert.equal(stored.tokenHash.length, 64);
});

test('login, refresh rotation, replay rejection, me and logout', async (t) => {
  if (!guard(t)) return;
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `tokens-${suffix}@example.test`;
  const password = 'StrongPassword123!';
  const registered = await api('POST', '/api/auth/register', { email, password, nickname: `T${suffix}` });
  assert.equal(registered.status, 201);
  const login = await api('POST', '/api/auth/login', { email, password });
  assert.equal(login.status, 200);
  assert.ok(login.body.data.accessToken);
  assert.equal((await api('POST', '/api/auth/login', { email, password: 'incorrect password' })).status, 401);
  const refreshed = await api('POST', '/api/auth/refresh', { refreshToken: login.body.data.refreshToken });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.data.refreshToken, login.body.data.refreshToken);
  assert.equal(
    (await api('POST', '/api/auth/refresh', { refreshToken: login.body.data.refreshToken })).status,
    401
  );
  const authenticated = client(srv.baseUrl, refreshed.body.data.accessToken);
  assert.equal((await authenticated('GET', '/api/auth/me')).status, 200);
  const { Player } = require('../../src/models');
  const ownPlayer = await Player.findOne({ where: { userId: refreshed.body.data.user.id } });
  assert.equal((await authenticated('GET', `/api/players/${ownPlayer.id}`)).status, 200);
  const newEmail = `renamed-${suffix}@example.test`;
  assert.equal(
    (await authenticated('PATCH', `/api/players/${ownPlayer.id}`, { email: newEmail })).status,
    200
  );
  assert.equal((await authenticated('GET', '/api/auth/me')).body.data.email, newEmail);
  const stranger = await Player.create({
    nickname: `S${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`,
    email: `stranger-${crypto.randomUUID()}@example.test`,
  });
  assert.equal((await authenticated('GET', `/api/players/${stranger.id}`)).status, 404);
  assert.equal(
    (await authenticated('POST', '/api/auth/logout', { refreshToken: refreshed.body.data.refreshToken }))
      .status,
    204
  );
  assert.equal(
    (await api('POST', '/api/auth/refresh', { refreshToken: refreshed.body.data.refreshToken })).status,
    401
  );
});
