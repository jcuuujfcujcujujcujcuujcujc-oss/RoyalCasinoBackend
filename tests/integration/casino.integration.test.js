'use strict';

// Royal Casino: casino-игры, виртуальные кредиты, статистика. HTTP + реальная PostgreSQL (БД *_test).
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

const slot = {
  name: 'Royal Fortune Slots',
  description: 'Educational virtual casino slot game',
  provider: 'Royal Games',
  category: 'slot',
  volatility: 'HIGH',
  minBet: 1,
  maxBet: 100,
  rtp: 96.5,
  tablesCount: 0,
};

test('/api/games: создание, Location по casino-пути, чтение через алиас /api/products', async (t) => {
  if (!guard(t)) return;
  const res = await api('POST', '/api/games', slot);
  assert.equal(res.status, 201);
  assert.match(res.headers.get('location'), /^\/api\/games\/\d+$/);
  assert.equal(res.body.data.provider, 'Royal Games');
  assert.equal(res.body.data.volatility, 'HIGH');
  assert.equal(typeof res.body.data.rtp, 'number');
  const viaLegacy = await api('GET', `/api/products/${res.body.data.id}`);
  assert.equal(viaLegacy.status, 200);
  assert.equal(viaLegacy.body.data.name, 'Royal Fortune Slots');
});

test('игры: dice и lottery создаются и привязываются к своим категориям', async (t) => {
  if (!guard(t)) return;
  for (const category of ['dice', 'lottery']) {
    const res = await api('POST', '/api/games', { ...slot, name: `Game ${category}`, category });
    assert.equal(res.status, 201);
    const cat = await api('GET', `/api/categories/${res.body.data.categoryId}`);
    assert.equal(cat.body.data.name, category);
  }
});

test('игры: RTP 0 и 100 допустимы, 100.01 и -1 -> 422; volatility вне набора -> 422', async (t) => {
  if (!guard(t)) return;
  assert.equal((await api('POST', '/api/games', { ...slot, rtp: 0 })).status, 201);
  assert.equal((await api('POST', '/api/games', { ...slot, rtp: 100 })).status, 201);
  assert.equal((await api('POST', '/api/games', { ...slot, rtp: 100.01 })).status, 422);
  assert.equal((await api('POST', '/api/games', { ...slot, rtp: -1 })).status, 422);
  assert.equal((await api('POST', '/api/games', { ...slot, volatility: 'EXTREME' })).status, 422);
});

test('игры: фильтры provider (без учёта регистра), volatility, isActive, category, сортировка и пагинация', async (t) => {
  if (!guard(t)) return;
  await api('POST', '/api/games', slot);
  await api('POST', '/api/games', { ...slot, name: 'B', provider: 'Other Studio', volatility: 'LOW', isActive: false });
  await api('POST', '/api/games', { ...slot, name: 'C', provider: 'Other Studio', category: 'roulette' });
  const total = (q) => api('GET', `/api/games${q}`).then((r) => r.body.meta.total);
  assert.equal(await total('?provider=royal%20games'), 1);
  assert.equal(await total('?provider=Other%20Studio'), 2);
  assert.equal(await total('?volatility=low'), 1);
  assert.equal(await total('?isActive=false'), 1);
  assert.equal(await total('?category=roulette'), 1);
  const page = await api('GET', '/api/games?limit=2&page=2&sortBy=name&order=desc');
  assert.equal(page.body.data.length, 1);
  assert.deepEqual(page.body.meta, { page: 2, limit: 2, total: 3, totalPages: 2 });
});

test('игры: PATCH provider/volatility, PUT сбрасывает необязательные поля к значениям по умолчанию', async (t) => {
  if (!guard(t)) return;
  const { body } = await api('POST', '/api/games', slot);
  const patched = await api('PATCH', `/api/games/${body.data.id}`, { volatility: 'low', provider: 'New Studio' });
  assert.equal(patched.body.data.volatility, 'LOW');
  assert.equal(patched.body.data.provider, 'New Studio');
  const put = await api('PUT', `/api/games/${body.data.id}`, { name: 'X', category: 'slot', minBet: 1, maxBet: 2, rtp: 90 });
  assert.equal(put.body.data.provider, 'Unknown');
  assert.equal(put.body.data.volatility, 'MEDIUM');
});

test('БД: CHECK на volatility и RTP срабатывают независимо от приложения', async (t) => {
  if (!guard(t)) return;
  const insert = (vol, rtp) =>
    ctx.sequelize.query(
      `INSERT INTO products (name, category, volatility, min_bet, max_bet, rtp) VALUES ('x','slot','${vol}',1,2,${rtp})`
    );
  await assert.rejects(insert('NONE', 90), (e) => e.parent && e.parent.code === '23514');
  await assert.rejects(insert('LOW', 100.5), (e) => e.parent && ['23514', '22003'].includes(e.parent.code));
  await insert('LOW', 100);
});

// ---------- Виртуальные кредиты ----------
test('кредиты: профиль создаётся вместе с игроком (1000 виртуальных кредитов), число в JSON', async (t) => {
  if (!guard(t)) return;
  const p = await api('POST', '/api/players', { nickname: 'HighRoller', email: 'hr@royal.test' });
  assert.equal(p.status, 201);
  assert.equal('passwordHash' in p.body.data, false);
  const credits = await api('GET', `/api/players/${p.body.data.id}/credits`);
  assert.equal(credits.status, 200);
  assert.equal(credits.body.data.balance, 1000);
  assert.equal(credits.body.data.playerId, p.body.data.id);
  assert.equal((await api('GET', '/api/players/99999/credits')).status, 404);
});

test('кредиты: PATCH/PUT игрока не меняет баланс; balance отклоняется', async (t) => {
  if (!guard(t)) return;
  const p = (await api('POST', '/api/players', { nickname: 'Cheater', email: 'c@royal.test' })).body.data;
  assert.equal((await api('PATCH', `/api/players/${p.id}`, { balance: 1e6 })).status, 422);
  const mixed = await api('PATCH', `/api/players/${p.id}`, { isActive: false, balance: 1e6, creditProfile: { balance: 1e6 } });
  assert.equal(mixed.status, 200);
  assert.equal((await api('GET', `/api/players/${p.id}/credits`)).body.data.balance, 1000);
});

test('кредиты: отрицательный баланс запрещён БД; удаление игрока каскадно удаляет профиль', async (t) => {
  if (!guard(t)) return;
  const p = (await api('POST', '/api/players', { nickname: 'Dave', email: 'd@royal.test' })).body.data;
  await assert.rejects(
    ctx.sequelize.query('UPDATE player_credit_profiles SET balance = -1 WHERE player_id = :id', { replacements: { id: p.id } }),
    (e) => e.parent && e.parent.code === '23514'
  );
  assert.equal((await api('DELETE', `/api/players/${p.id}`)).status, 204);
  const [rows] = await ctx.sequelize.query('SELECT 1 FROM player_credit_profiles WHERE player_id = :id', { replacements: { id: p.id } });
  assert.equal(rows.length, 0);
});

test('кредиты: дубликат игрока не оставляет «осиротевшего» профиля (транзакция откатывается)', async (t) => {
  if (!guard(t)) return;
  await api('POST', '/api/players', { nickname: 'Eve', email: 'e@royal.test' });
  assert.equal((await api('POST', '/api/players', { nickname: 'eve', email: 'x@royal.test' })).status, 409);
  const [[{ count }]] = await ctx.sequelize.query('SELECT COUNT(*)::int AS count FROM player_credit_profiles');
  assert.equal(count, 1);
});

// ---------- Статистика ----------
test('статистика: игроки, игры, категории, провайдеры, сумма виртуальных кредитов', async (t) => {
  if (!guard(t)) return;
  await api('POST', '/api/games', slot);
  await api('POST', '/api/games', { ...slot, name: 'Dice', category: 'dice', provider: 'Other Studio', isActive: false });
  await api('POST', '/api/players', { nickname: 'P01', email: 'p1@royal.test' });
  await api('POST', '/api/players', { nickname: 'P02', email: 'p2@royal.test' });

  const all = await api('GET', '/api/casino/statistics');
  assert.equal(all.status, 200);
  const { players, games } = all.body.data;
  assert.equal(players.totalPlayers, 2);
  assert.equal(players.totalVirtualCredits, 2000);
  assert.equal(games.totalGames, 2);
  assert.equal(games.activeGames, 1);
  assert.equal(games.inactiveGames, 1);

  const g = (await api('GET', '/api/casino/statistics/games')).body.data;
  assert.equal(g.byCategory.find((c) => c.category === 'slot').gamesCount, 1);
  assert.equal(g.byCategory.find((c) => c.category === 'dice').gamesCount, 1);
  assert.equal(g.byCategory.find((c) => c.category === 'poker').gamesCount, 0);
  assert.deepEqual(g.byProvider.map((x) => x.provider).sort(), ['Other Studio', 'Royal Games']);

  const p = (await api('GET', '/api/casino/statistics/players')).body.data;
  assert.equal(p.activePlayers, 2);
  assert.equal(p.creditProfiles, 2);
});

test('статистика на пустой БД возвращает нули, а не ошибку', async (t) => {
  if (!guard(t)) return;
  const res = await api('GET', '/api/casino/statistics');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.players.totalVirtualCredits, 0);
  assert.equal(res.body.data.games.totalGames, 0);
});

test('категории: casino-путь /api/categories, дубликат -> 409, удаление занятой -> 409', async (t) => {
  if (!guard(t)) return;
  const created = await api('POST', '/api/categories', { name: 'Keno' });
  assert.equal(created.status, 201);
  assert.match(created.headers.get('location'), /^\/api\/categories\/\d+$/);
  assert.equal((await api('POST', '/api/categories', { name: 'KENO' })).status, 409);
  // categoryId и legacy-строка category не должны противоречить друг другу,
  // поэтому при назначении новой категории слаг из шаблона slot убираем.
  const { category, ...rest } = slot;
  const g = await api('POST', '/api/games', { ...rest, categoryId: created.body.data.id });
  assert.equal(g.status, 201);
  assert.equal((await api('DELETE', `/api/categories/${created.body.data.id}`)).status, 409);
});
