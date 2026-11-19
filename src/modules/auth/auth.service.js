'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { User, Role, UserRole, RefreshToken, Player, sequelize } = require('../../models');
const { createStarterProfile } = require('../player-credits/credit.service');
const { AppError } = require('../../errors/AppError');
const { record } = require('../audit/audit.service');
const DUMMY_PASSWORD_HASH = '$2b$12$gg3GZ5M.HkL6j9g9pWHTiOyKbW0tmG0xWp4wHSOmCyEfdPWusA/IG';

const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
function configSecret() {
  if (!env.auth.jwtSecret || Buffer.byteLength(env.auth.jwtSecret) < 32)
    throw new AppError(503, 'Аутентификация не настроена', 'AUTH_NOT_CONFIGURED');
  return env.auth.jwtSecret;
}
function validateCredentials(email, password) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized))
    throw new AppError(422, 'Некорректный email', 'VALIDATION_ERROR');
  if (
    typeof password !== 'string' ||
    Buffer.byteLength(password, 'utf8') < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new AppError(422, 'Пароль должен занимать от 12 до 72 байт', 'VALIDATION_ERROR');
  }
  return normalized;
}
async function issue(user, transaction) {
  const roles = await user.getRoles({ transaction });
  const roleCodes = roles.map((role) => role.code);
  const accessToken = jwt.sign({ sub: String(user.id), roles: roleCodes }, configSecret(), {
    algorithm: 'HS256',
    expiresIn: env.auth.accessTtl,
    issuer: 'royal-casino-backend',
    audience: 'royal-casino-api',
  });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create(
    {
      userId: user.id,
      tokenHash: digest(refreshToken),
      expiresAt: new Date(Date.now() + env.auth.refreshTtlDays * 86400000),
    },
    { transaction }
  );
  return { accessToken, refreshToken };
}
async function register({ email, password, nickname }) {
  const normalized = validateCredentials(email, password);
  if (typeof nickname !== 'string' || !/^[A-Za-z0-9_.-]{3,30}$/.test(nickname.trim()))
    throw new AppError(
      422,
      'Никнейм должен содержать 3–30 латинских букв, цифр, точки, дефиса или подчёркивания',
      'VALIDATION_ERROR'
    );
  return sequelize.transaction(async (transaction) => {
    const passwordHash = await bcrypt.hash(password, env.auth.bcryptRounds);
    const user = await User.create({ email: normalized, passwordHash }, { transaction });
    const role = await Role.findOne({ where: { code: 'PLAYER' }, transaction });
    if (!role) throw new AppError(503, 'Роли не созданы; примените миграции', 'AUTH_NOT_CONFIGURED');
    await UserRole.create({ userId: user.id, roleId: role.id }, { transaction });
    const player = await Player.create(
      { nickname: nickname.trim(), email: normalized, userId: user.id },
      { transaction }
    );
    await createStarterProfile(player.id, transaction);
    await record(
      { userId: user.id, action: 'REGISTER', entityType: 'User', entityId: user.id, details: {} },
      transaction
    );
    return {
      user: { id: user.id, email: user.email, roles: ['PLAYER'] },
      ...(await issue(user, transaction)),
    };
  });
}
async function login({ email, password }) {
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.length > 254 ||
    Buffer.byteLength(password, 'utf8') > 72
  )
    throw new AppError(
      422,
      'Требуются корректные email и пароль (пароль не более 72 байт)',
      'VALIDATION_ERROR'
    );
  const user = await User.unscoped().findOne({
    where: { email: email.trim().toLowerCase() },
    attributes: ['id', 'email', 'passwordHash', 'isActive'],
    include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
  });
  // Constant-cost compare for unknown accounts reduces email enumeration signals.
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user || !user.isActive || !valid)
    throw new AppError(401, 'Неверный email или пароль', 'INVALID_CREDENTIALS');
  return sequelize.transaction(async (transaction) => {
    await record(
      { userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, details: {} },
      transaction
    );
    const result = await issue(user, transaction);
    return {
      user: { id: user.id, email: user.email, roles: user.roles.map((role) => role.code) },
      ...result,
    };
  });
}
async function refresh(raw) {
  if (typeof raw !== 'string' || raw.length < 50 || raw.length > 200)
    throw new AppError(401, 'Недействительный refresh token', 'INVALID_REFRESH_TOKEN');
  return sequelize.transaction(async (transaction) => {
    const stored = await RefreshToken.findOne({
      where: { tokenHash: digest(raw) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date())
      throw new AppError(401, 'Refresh token истёк или отозван', 'INVALID_REFRESH_TOKEN');
    const user = await User.findByPk(stored.userId, {
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user?.isActive) throw new AppError(401, 'Сеанс недействителен', 'INVALID_REFRESH_TOKEN');
    stored.revokedAt = new Date();
    await stored.save({ transaction });
    await record(
      { userId: user.id, action: 'TOKEN_REFRESH', entityType: 'User', entityId: user.id, details: {} },
      transaction
    );
    return {
      user: { id: user.id, email: user.email, roles: user.roles.map((role) => role.code) },
      ...(await issue(user, transaction)),
    };
  });
}
async function logout(raw, userId) {
  return sequelize.transaction(async (transaction) => {
    if (typeof raw === 'string' && raw.length <= 200) {
      const token = await RefreshToken.findOne({
        where: { tokenHash: digest(raw), userId, revokedAt: null },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (token) {
        token.revokedAt = new Date();
        await token.save({ transaction });
      }
    }
    await record(
      { userId, action: 'LOGOUT', entityType: 'User', entityId: userId, details: {} },
      transaction
    );
  });
}
module.exports = { register, login, refresh, logout, validateCredentials };
