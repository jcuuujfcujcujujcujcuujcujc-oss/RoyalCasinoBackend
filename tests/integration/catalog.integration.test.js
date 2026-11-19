'use strict';

// HTTP + реальная PostgreSQL: Product (PATCH, categoryId), GameCategory, Player.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { connect, reset, startServer, client } = require('../helpers/db');

let ctx;
let srv;
let api;

before(async () => {
  ctx = await connect();
  if (!ctx.ok) return;
  srv = await startServer();
  api = client(srv.baseUrl, ctx.token);
});
after(async () => {
  if (srv) await new Promise((r) => srv.server.close(r));
  if (ctx && ctx.ok) await ctx.sequelize.close();
});
beforeEach(async () => {
  if (ctx.ok) await reset(ctx.sequelize);
});

const guard = (t) => {
  if (!ctx.ok) {
    t.skip(ctx.reason);
    return false;
  }
  return true;
};

const game = {
  name: 'Royal Fortune Slots',
  description: 'Educational virtual casino slot game',
  provider: 'Royal Games',
  volatility: 'HIGH',
  category: 'slot',
  minBet: 1,
  maxBet: 100,
  rtp: 96.5,
};

// ---------- health ----------
test('GET /api/health', async (t) => {
  if (!guard(t)) return;
  assert.equal((await api('GET', '/api/health')).status, 200);
});

// ---------- Product ----------
test('Product: создание -> 201, Location, categoryId подбирается по category', async (t) => {
  if (!guard(t)) return;
  const res = await api('POST', '/api/products', game);
  assert.equal(res.status, 201);
  assert.match(res.headers.get('location'), /^\/api\/products\/\d+$/);
  assert.equal(res.body.data.category, 'slot');
  assert.equal(typeof res.body.data.categoryId, 'number');
  assert.equal(res.body.data.minBet, 1);
});

test('Product PATCH: только minBet проверяется против существующего maxBet', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/products', game);
  const id = body.data.id;
  const bad = await api('PATCH', `/api/products/${id}`, { minBet: 150 });
  assert.equal(bad.status, 422);
  assert.equal(bad.body.error.details[0].field, 'maxBet');
  const ok = await api('PATCH', `/api/products/${id}`, { minBet: 100 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.minBet, 100);
  assert.equal((await api('GET', `/api/products/${id}`)).body.data.minBet, 100);
});

test('Product PATCH: только maxBet проверяется против существующего minBet', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/products', game);
  const bad = await api('PATCH', `/api/products/${body.data.id}`, { maxBet: 0.5 });
  assert.equal(bad.status, 422);
  const stored = (await api('GET', `/api/products/${body.data.id}`)).body.data;
  assert.equal(stored.maxBet, 100, 'значение в БД не изменилось');
});

test('Product PATCH: частичное обновление не затрагивает остальные поля', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/products', { ...game, description: 'desc', tablesCount: 3 });
  const res = await api('PATCH', `/api/products/${body.data.id}`, { isActive: false });
  assert.equal(res.body.data.isActive, false);
  assert.equal(res.body.data.description, 'desc');
  assert.equal(res.body.data.tablesCount, 3);
});

test('Product: параллельные PATCH minBet/maxBet не нарушают CHECK (нет 500)', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/products', { ...game, minBet: 10, maxBet: 50 });
  const id = body.data.id;
  const [a, b] = await Promise.all([
    api('PATCH', `/api/products/${id}`, { minBet: 40 }),
    api('PATCH', `/api/products/${id}`, { maxBet: 20 }),
  ]);
  assert.ok(
    [a.status, b.status].every((s) => s === 200 || s === 422),
    `статусы: ${a.status}, ${b.status}`
  );
  const stored = (await api('GET', `/api/products/${id}`)).body.data;
  assert.ok(stored.minBet <= stored.maxBet);
});

test('Product: PUT, DELETE, 404', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/products', game);
  const id = body.data.id;
  const put = await api('PUT', `/api/products/${id}`, { ...game, name: 'Renamed', category: 'roulette' });
  assert.equal(put.status, 200);
  assert.equal(put.body.data.name, 'Renamed');
  assert.equal((await api('DELETE', `/api/products/${id}`)).status, 204);
  assert.equal((await api('GET', `/api/products/${id}`)).status, 404);
});

test('Product: mass assignment - id из тела игнорируется', async (t) => {
  if (!guard(t)) return;
  const res = await api('POST', '/api/products', { ...game, id: 999, createdAt: '2000-01-01T00:00:00Z' });
  assert.equal(res.status, 201);
  assert.notEqual(res.body.data.id, 999);
  assert.notEqual(res.body.data.createdAt.slice(0, 4), '2000');
});

// ---------- GameCategory ----------
test('GameCategory: создание, получение, список, обновление', async (t) => {
  if (!guard(t)) return;
  const created = await api('POST', '/api/game-categories', { name: 'Bingo', description: 'Бинго' });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal((await api('GET', `/api/game-categories/${id}`)).body.data.name, 'Bingo');
  const list = await api('GET', '/api/game-categories?limit=100');
  assert.equal(list.body.meta.total, 9); // 8 начальных + Bingo
  const patched = await api('PATCH', `/api/game-categories/${id}`, { isActive: false });
  assert.equal(patched.body.data.isActive, false);
  const put = await api('PUT', `/api/game-categories/${id}`, { name: 'Bingo 2' });
  assert.equal(put.body.data.name, 'Bingo 2');
  assert.equal((await api('GET', '/api/game-categories/99999')).status, 404);
});

test('GameCategory: имя уникально без учёта регистра -> 409', async (t) => {
  if (!guard(t)) return;
  assert.equal((await api('POST', '/api/game-categories', { name: 'SLOT' })).status, 409);
});

test('Product: назначение категории по categoryId и фильтр по ней', async (t) => {
  if (!guard(t)) return;
  const cat = (await api('POST', '/api/game-categories', { name: 'Bingo' })).body.data;
  const gameWithoutCategory = { ...game };
  delete gameWithoutCategory.category;
  const created = await api('POST', '/api/products', { ...gameWithoutCategory, categoryId: cat.id });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.categoryId, cat.id);
  assert.equal(created.body.data.category, 'other'); // устаревшее поле выводится из имени категории
  await api('POST', '/api/products', game);
  const filtered = await api('GET', `/api/products?categoryId=${cat.id}`);
  assert.equal(filtered.body.meta.total, 1);
  assert.equal(filtered.body.data[0].id, created.body.data.id);
  const bySlug = await api('GET', '/api/products?category=slot');
  assert.equal(bySlug.body.meta.total, 1);
});

test('Product: несуществующий categoryId -> 422; несогласованные category/categoryId -> 422', async (t) => {
  if (!guard(t)) return;
  assert.equal((await api('POST', '/api/products', { ...game, categoryId: 99999 })).status, 422);
  const roulette = (await api('GET', '/api/game-categories?sortBy=name&limit=100')).body.data.find(
    (c) => c.name === 'roulette'
  );
  assert.equal((await api('POST', '/api/products', { ...game, categoryId: roulette.id })).status, 422);
});

test('Product PATCH: categoryId меняет связь, null снимает её', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/products', game);
  const poker = (await api('GET', '/api/game-categories?limit=100')).body.data.find(
    (c) => c.name === 'poker'
  );
  const moved = await api('PATCH', `/api/products/${body.data.id}`, { categoryId: poker.id });
  assert.equal(moved.body.data.category, 'poker');
  const detached = await api('PATCH', `/api/products/${body.data.id}`, { categoryId: null });
  assert.equal(detached.body.data.categoryId, null);
  assert.equal(detached.body.data.category, 'poker');
});

test('GameCategory: удаление занятой категории -> 409, продукт и категория сохранены', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/products', game);
  const res = await api('DELETE', `/api/game-categories/${body.data.categoryId}`);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONFLICT');
  assert.equal((await api('GET', `/api/game-categories/${body.data.categoryId}`)).status, 200);
  assert.equal((await api('GET', `/api/products/${body.data.id}`)).status, 200);
});

test('GameCategory: удаление неиспользуемой категории -> 204', async (t) => {
  if (!guard(t)) return;
  const cat = (await api('POST', '/api/game-categories', { name: 'Unused' })).body.data;
  assert.equal((await api('DELETE', `/api/game-categories/${cat.id}`)).status, 204);
  assert.equal((await api('GET', `/api/game-categories/${cat.id}`)).status, 404);
});

test('БД: внешний ключ RESTRICT срабатывает и без проверки приложения', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/products', game);
  await assert.rejects(
    ctx.sequelize.query('DELETE FROM game_categories WHERE id = :id', {
      replacements: { id: body.data.categoryId },
    }),
    (err) => err.parent && err.parent.code === '23503'
  );
});

// ---------- Player ----------
const player = { nickname: 'Neo', email: 'Neo@Matrix.io' };

test('Player: полный CRUD', async (t) => {
  if (!guard(t)) return;
  const created = await api('POST', '/api/players', player);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.email, 'neo@matrix.io');
  const id = created.body.data.id;
  assert.equal((await api('GET', `/api/players/${id}`)).body.data.nickname, 'Neo');
  assert.equal((await api('GET', '/api/players')).body.meta.total, 1);
  assert.equal((await api('PATCH', `/api/players/${id}`, { isActive: false })).body.data.isActive, false);
  const put = await api('PUT', `/api/players/${id}`, { nickname: 'Trinity', email: 'trinity@matrix.io' });
  assert.equal(put.body.data.nickname, 'Trinity');
  assert.equal((await api('DELETE', `/api/players/${id}`)).status, 204);
  assert.equal((await api('GET', `/api/players/${id}`)).status, 404);
});

test('Player: дубликат nickname (в т.ч. в другом регистре) -> 409', async (t) => {
  if (!guard(t)) return;
  await api('POST', '/api/players', player);
  const dup = await api('POST', '/api/players', { nickname: 'NEO', email: 'other@matrix.io' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.details[0].field, 'nickname');
});

test('Player: дубликат email -> 409; PATCH на чужой email -> 409', async (t) => {
  if (!guard(t)) return;
  await api('POST', '/api/players', player);
  const dup = await api('POST', '/api/players', { nickname: 'Morpheus', email: 'NEO@matrix.io' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.details[0].field, 'email');
  const other = (await api('POST', '/api/players', { nickname: 'Morpheus', email: 'm@matrix.io' })).body.data;
  assert.equal((await api('PATCH', `/api/players/${other.id}`, { email: 'neo@matrix.io' })).status, 409);
});

test('Player: ограничения уникальности существуют на уровне БД', async (t) => {
  if (!guard(t)) return;
  await ctx.sequelize.query("INSERT INTO players (nickname, email) VALUES ('Direct', 'd@x.io')");
  await assert.rejects(
    ctx.sequelize.query("INSERT INTO players (nickname, email) VALUES ('direct', 'e@x.io')"),
    (err) => err.parent && err.parent.code === '23505'
  );
  await assert.rejects(
    ctx.sequelize.query("INSERT INTO players (nickname, email) VALUES ('Other', 'd@x.io')"),
    (err) => err.parent && err.parent.code === '23505'
  );
});

test('Player: валидация -> 422, неверный id -> 400', async (t) => {
  if (!guard(t)) return;
  assert.equal((await api('POST', '/api/players', { nickname: 'x', email: 'bad' })).status, 422);
  assert.equal((await api('GET', '/api/players/abc')).status, 400);
});
