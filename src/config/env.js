'use strict';

require('dotenv').config({ quiet: true });

const toBool = (value, fallback = false) =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

const toTrustProxy = (value) => {
  if (value === undefined || ['false', '0', 'off', ''].includes(String(value).toLowerCase())) return false;
  if (['true', 'on'].includes(String(value).toLowerCase())) {
    throw new Error('TRUST_PROXY должен задавать число переходов или доверенные адреса, не true');
  }
  if (/^\d+$/.test(String(value))) return Number(value);
  return String(value);
};

const toPort = (value, fallback) => {
  const port = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Некорректный порт: ${value}`);
  }
  return port;
};

const toBoundedInt = (value, fallback, min, max, name) => {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} должен быть целым числом`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${name} должен быть в диапазоне ${min}..${max}`);
  return parsed;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toPort(process.env.PORT, 3000),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: toPort(process.env.DB_PORT, 5432),
    name: process.env.DB_NAME || 'universal_backend',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: toBool(process.env.DB_SSL, false),
    logging: toBool(process.env.DB_LOGGING, false),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtlDays: toBoundedInt(process.env.REFRESH_TOKEN_TTL_DAYS, 7, 1, 90, 'REFRESH_TOKEN_TTL_DAYS'),
    bcryptRounds: toBoundedInt(process.env.BCRYPT_ROUNDS, 12, 10, 15, 'BCRYPT_ROUNDS'),
  },
  corsOrigin: process.env.CORS_ORIGIN || '',
  trustProxy: toTrustProxy(process.env.TRUST_PROXY),
  enableDocs: toBool(process.env.ENABLE_DOCS, process.env.NODE_ENV !== 'production'),
  auditRetentionDays: toBoundedInt(process.env.AUDIT_RETENTION_DAYS, 365, 30, 3650, 'AUDIT_RETENTION_DAYS'),
  logLevel: process.env.LOG_LEVEL || 'info',
};

env.isProduction = env.nodeEnv === 'production';

if (!['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].includes(env.logLevel)) {
  throw new Error('LOG_LEVEL должен быть одним из fatal/error/warn/info/debug/trace/silent');
}
if (env.isProduction && env.db.logging) throw new Error('DB_LOGGING нельзя включать в production');

if (env.isProduction) {
  const missing = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    throw new Error(`Не заданы обязательные переменные окружения: ${missing.join(', ')}`);
  }
  if (['change_me', 'password', 'example', 'changeme'].includes(process.env.DB_PASSWORD.toLowerCase())) {
    throw new Error('DB_PASSWORD содержит небезопасное шаблонное значение');
  }
}

if (
  env.auth.jwtSecret &&
  (Buffer.byteLength(env.auth.jwtSecret) < 32 || env.auth.jwtSecret.startsWith('replace_with_'))
) {
  throw new Error('JWT_SECRET должен содержать не менее 32 байт');
}
const accessTtlMatch = /^(\d+)(s|m|h|d)$/.exec(env.auth.accessTtl);
const accessTtlSeconds =
  accessTtlMatch && Number(accessTtlMatch[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[accessTtlMatch[2]];
if (
  !accessTtlMatch ||
  !Number.isSafeInteger(accessTtlSeconds) ||
  accessTtlSeconds < 1 ||
  accessTtlSeconds > 86400
) {
  throw new Error(
    'ACCESS_TOKEN_TTL должен быть временем в секундах, минутах, часах или днях и не превышать 24 часа'
  );
}

module.exports = env;
