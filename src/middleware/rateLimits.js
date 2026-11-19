'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const login = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Слишком много попыток входа; повторите позже' } },
});

const loginAccount = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    typeof req.body?.email === 'string'
      ? `email:${req.body.email.trim().toLowerCase()}`
      : `ip:${ipKeyGenerator(req.ip)}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль' } },
});

const register = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const api = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

module.exports = { login, loginAccount, register, api };
