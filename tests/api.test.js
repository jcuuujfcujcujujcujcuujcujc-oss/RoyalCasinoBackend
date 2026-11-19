'use strict';

// HTTP-тесты: не требуют подключения к БД, т.к. проверяют только маршруты и валидацию,
// которая срабатывает до обращения к базе. Требуют установленных зависимостей (npm install).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.LOG_LEVEL = 'silent';
const app = require('../src/app');
const { sequelize } = require('../src/models');
const openapi = require('../src/docs/openapi');

let server;
let baseUrl;

before(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    })
);

after(() => new Promise((resolve) => server.close(resolve)));

const send = (method, path, body, raw = false) =>
  fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });

const validGame = {
  name: 'Royal Fortune Slots',
  provider: 'Royal Games',
  volatility: 'HIGH',
  category: 'slot',
  minBet: 0.1,
  maxBet: 100,
  rtp: 96.5,
};

test('OpenAPI describes readiness, session logout, and credit ledger routes', () => {
  assert.ok(openapi.paths['/api/health/ready']);
  assert.ok(openapi.paths['/api/auth/logout-all']);
  assert.ok(openapi.paths['/api/players/{id}/credits/transactions']);
  assert.ok(openapi.paths['/api/players/{id}/credits/adjustments']);
  const readiness503 = openapi.paths['/api/health/ready'].get.responses[503];
  assert.equal(readiness503.content['application/json'].schema.properties.status.enum[0], 'not_ready');
});

test('GET /api/health -> 200 и защитные заголовки', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.match(res.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  const health = await res.json();
  assert.equal(health.status, 'ok');
  assert.equal(health.service, 'royal-casino-backend');
});

test('GET /api/health/ready reports database readiness without leaking errors', async (t) => {
  t.mock.method(sequelize, 'authenticate', async () => undefined);
  const ready = await fetch(`${baseUrl}/api/health/ready`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).status, 'ready');
});

test('GET /api/health/ready returns 503 and hides database details on failure', async (t) => {
  t.mock.method(sequelize, 'authenticate', async () => {
    throw new Error('password=secret');
  });
  const ready = await fetch(`${baseUrl}/api/health/ready`);
  assert.equal(ready.status, 503);
  const payload = await ready.json();
  assert.equal(payload.status, 'not_ready');
  assert.equal(JSON.stringify(payload).includes('secret'), false);
});

test('health probe не расходует API rate limit', async () => {
  for (let i = 0; i < 301; i += 1) {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
  }
});

test('неизвестный маршрут -> 404', async () => {
  const res = await fetch(`${baseUrl}/api/nope`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

test('POST /api/products с битым JSON -> 400', async () => {
  const res = await send('POST', '/api/products', '{bad', true);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_JSON');
});

test('POST /api/products без токена -> 401', async () => {
  const res = await send('POST', '/api/products', {});
  assert.equal(res.status, 401);
});

test('POST /api/products требует аутентификацию даже при невалидном теле', async () => {
  // 'lottery' добавлен в CATEGORIES на этапе Royal Casino, поэтому неизвестным
  // должен быть слаг, которого действительно нет в белом списке.
  const res = await send('POST', '/api/products', { ...validGame, category: 'bingo' });
  assert.equal(res.status, 401);
});

test('POST /api/products с minBet > maxBet без токена -> 401', async () => {
  const res = await send('POST', '/api/products', { ...validGame, minBet: 500, maxBet: 100 });
  assert.equal(res.status, 401);
});

test('PATCH /api/products/1 с пустым телом без токена -> 401', async () => {
  const res = await send('PATCH', '/api/products/1', {});
  assert.equal(res.status, 401);
});

test('PUT /api/products/1 без токена -> 401', async () => {
  const res = await send('PUT', '/api/products/1', { name: 'Only name' });
  assert.equal(res.status, 401);
});

test('GET /api/products/abc -> 400', async () => {
  const res = await fetch(`${baseUrl}/api/products/abc`);
  assert.equal(res.status, 400);
});

test('GET /api/products?limit=1000 -> 422', async () => {
  const res = await fetch(`${baseUrl}/api/products?limit=1000`);
  assert.equal(res.status, 422);
});

// ---- GameCategory / Player: валидация и маршрутизация до обращения к БД ----

test('POST /api/game-categories требует аутентификацию', async () => {
  const res = await send('POST', '/api/game-categories', {});
  assert.equal(res.status, 401);
});

test('GET /api/game-categories/0 -> 400; DELETE без токена -> 401', async () => {
  assert.equal((await fetch(`${baseUrl}/api/game-categories/0`)).status, 400);
  assert.equal((await send('DELETE', '/api/game-categories/abc')).status, 401);
});

test('PATCH /api/game-categories/1 без токена -> 401', async () => {
  assert.equal((await send('PATCH', '/api/game-categories/1', {})).status, 401);
});

test('POST /api/players требует ADMIN или MANAGER', async () => {
  const res = await send('POST', '/api/players', { nickname: 'ab', email: 'nope' });
  assert.equal(res.status, 401);
});

test('GET /api/players требует Bearer-токен', async () => {
  assert.equal((await fetch(`${baseUrl}/api/players/-5`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/players?isActive=1`)).status, 401);
});

test('GET каталога валидирует фильтр; POST требует Bearer-токен', async () => {
  assert.equal((await fetch(`${baseUrl}/api/products?categoryId=abc`)).status, 422);
  const gameWithoutCategory = { ...validGame };
  delete gameWithoutCategory.category;
  assert.equal((await send('POST', '/api/products', { ...gameWithoutCategory, categoryId: 0 })).status, 401);
});

test('body-parser: неподдерживаемая кодировка -> 415, а не 500', async () => {
  // charset=utf-7 поддерживается iconv-lite, поэтому тело успешно разбиралось и
  // запрос доходил до валидации (422). Берём кодировку, которой нет в iconv-lite.
  const res = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=x-unknown-8bit' },
    body: '{}',
  });
  assert.equal(res.status, 415);
});

// ---- Royal Casino: основные casino-пути и совместимые алиасы ----

test('алиасы: /api/games и /api/products защищают создание одинаково', async () => {
  for (const base of ['/api/games', '/api/products']) {
    const res = await send('POST', base, {});
    assert.equal(res.status, 401, base);
  }
});

test('алиасы: /api/categories и /api/game-categories', async () => {
  for (const base of ['/api/categories', '/api/game-categories']) {
    assert.equal((await send('POST', base, {})).status, 401, base);
    assert.equal((await fetch(`${baseUrl}${base}/abc`)).status, 400, base);
  }
});

test('POST /api/games требует роль даже с неверным телом', async () => {
  const res = await send('POST', '/api/games', {
    ...validGame,
    volatility: 'EXTREME',
    rtp: 101,
    provider: '',
  });
  assert.equal(res.status, 401);
});

test('GET /api/games?volatility=x и ?provider= -> 422', async () => {
  assert.equal((await fetch(`${baseUrl}/api/games?volatility=x`)).status, 422);
  assert.equal((await fetch(`${baseUrl}/api/games?provider=`)).status, 422);
});

test('GET /api/players/abc/credits и PATCH профиля требуют вход', async () => {
  assert.equal((await fetch(`${baseUrl}/api/players/abc/credits`)).status, 401);
  const res = await send('PATCH', '/api/players/1', { balance: 999999 });
  assert.equal(res.status, 401);
});

test('статистика защищена аутентификацией (POST без токена -> 401)', async () => {
  assert.equal((await send('POST', '/api/casino/statistics', {})).status, 401);
});

test('GET каталог остаётся публичным, а POST требует Bearer-токен', async () => {
  assert.equal((await fetch(`${baseUrl}/api/games?limit=1000`)).status, 422);
  assert.equal((await send('POST', '/api/games', validGame)).status, 401);
});

test('поиск и максимальное смещение страницы валидируются до обращения к PostgreSQL', async () => {
  assert.equal((await fetch(`${baseUrl}/api/games?search=`)).status, 422);
  assert.equal((await fetch(`${baseUrl}/api/games?search=${'x'.repeat(101)}`)).status, 422);
  assert.equal((await fetch(`${baseUrl}/api/games?page=1000000&limit=100`)).status, 422);
});

test('Swagger UI и OpenAPI доступны', async () => {
  const docs = await fetch(`${baseUrl}/api/docs/`);
  assert.equal(docs.status, 200);
  assert.match(docs.headers.get('content-security-policy'), /script-src[^;]*unsafe-inline/);
  const spec = await fetch(`${baseUrl}/api/openapi.json`);
  assert.equal(spec.status, 200);
  assert.equal((await spec.json()).components.securitySchemes.bearerAuth.scheme, 'bearer');
});
