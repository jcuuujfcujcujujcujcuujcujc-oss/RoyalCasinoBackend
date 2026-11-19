'use strict';

// Помощники интеграционных тестов с реальной PostgreSQL.
// Безопасность: тесты работают ТОЛЬКО с базой, имя которой оканчивается на "_test",
// и очищают в ней таблицы. Иначе (или если БД/миграции недоступны) тесты пропускаются.

const { CATEGORIES } = require('../../src/modules/products/product.validation');
const crypto = require('node:crypto');

const TABLES = ['products', 'game_categories', 'players', 'player_credit_profiles', 'users', 'roles', 'user_roles', 'refresh_tokens', 'audit_logs'];

async function connect() {
  process.env.JWT_SECRET ||= crypto.randomBytes(48).toString('base64url');
  let env;
  try {
    env = require('../../src/config/env');
  } catch (err) {
    return { ok: false, reason: `зависимости не установлены: ${err.message.split('\n')[0]}` };
  }
  if (!/_test$/.test(env.db.name)) {
    return { ok: false, reason: `DB_NAME="${env.db.name}" не оканчивается на _test: интеграционные тесты пропущены` };
  }
  try {
    const models = require('../../src/models');
    const { sequelize, User, Role, UserRole } = models;
    await sequelize.authenticate();
    // showAllTables() возвращает имена таблиц текущей схемы. Раньше здесь выполнялся
    // SELECT table_name ... и результат разбирался как [rows]; для одноколоночного
    // результата типа sql_identifier Sequelize возвращает массив строк-массивов,
    // поэтому проверка всегда видела одну таблицу и все интеграционные тесты
    // помечались как "миграции не применены".
    const tables = await sequelize.getQueryInterface().showAllTables();
    const missing = TABLES.filter((table) => !tables.includes(table));
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `миграции не применены к тестовой БД (нет таблиц: ${missing.join(', ')}; npm run db:migrate при NODE_ENV=test)`,
      };
    }
  } catch (err) {
    return { ok: false, reason: `тестовая БД недоступна: ${err.message}` };
  }
  const models = require('../../src/models');
  const { sequelize, User, Role, UserRole } = models;
  const email = 'integration-admin@example.test';
  let admin = await User.findOne({ where: { email } });
  if (!admin) admin = await User.create({ email, passwordHash: await require('bcryptjs').hash(crypto.randomBytes(32).toString('hex'), 10) });
  const role = await Role.findOne({ where: { code: 'ADMIN' } });
  await UserRole.findOrCreate({ where: { userId: admin.id, roleId: role.id } });
  const token = require('jsonwebtoken').sign({ sub: String(admin.id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m', issuer: 'royal-casino-backend', audience: 'royal-casino-api' });
  return { ok: true, sequelize, token };
}

// Чистое состояние; категории пересеваются тем же набором, что объявлен в product.validation.js,
// чтобы список тестовых категорий не расходился с бизнес-валидацией.
async function reset(sequelize) {
  await sequelize.query('TRUNCATE products, game_categories, players, player_credit_profiles, audit_logs RESTART IDENTITY CASCADE');
  await sequelize.query('INSERT INTO game_categories (name) VALUES ' + CATEGORIES.map((_, i) => `($${i + 1})`).join(', '), {
    bind: CATEGORIES,
  });
}

function startServer() {
  const app = require('../../src/app');
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

const client = (baseUrl, token) => async (method, path, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
};

module.exports = { connect, reset, startServer, client };
