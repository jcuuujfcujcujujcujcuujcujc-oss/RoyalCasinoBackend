'use strict';
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { User, Role, Player } = require('../../models');
const { AppError } = require('../../errors/AppError');

async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(header)) return next(new AppError(401, 'Требуется Bearer Access Token', 'UNAUTHORIZED'));
  let payload;
  try {
    if (!env.auth.jwtSecret || Buffer.byteLength(env.auth.jwtSecret) < 32) throw new Error('secret missing');
    payload = jwt.verify(header.replace(/^Bearer\s+/i, ''), env.auth.jwtSecret, { algorithms: ['HS256'], issuer: 'royal-casino-backend', audience: 'royal-casino-api' });
  } catch {
    return next(new AppError(401, 'Access Token недействителен или истёк', 'UNAUTHORIZED'));
  }
  const user = await User.findByPk(Number(payload.sub), { include: [{ model: Role, as: 'roles', through: { attributes: [] } }, { model: Player, as: 'player', attributes: ['id'] }] });
  if (!user || !user.isActive) return next(new AppError(401, 'Учётная запись отключена или не найдена', 'UNAUTHORIZED'));
  req.auth = { id: user.id, email: user.email, roles: user.roles.map((role) => role.code), playerId: user.player?.id ?? null };
  next();
}

const authorize = (...allowed) => (req, res, next) => {
  if (!req.auth) return next(new AppError(401, 'Требуется аутентификация', 'UNAUTHORIZED'));
  if (!req.auth.roles.some((role) => allowed.includes(role))) return next(new AppError(403, 'Недостаточно прав', 'FORBIDDEN'));
  next();
};

function ownerOrAdmin(req, res, next) {
  if (req.auth.roles.includes('ADMIN')) return next();
  if (!req.auth.playerId || String(req.auth.playerId) !== String(req.params.id)) return next(new AppError(404, 'Объект не найден', 'NOT_FOUND'));
  next();
}

module.exports = { authenticate, authorize, ownerOrAdmin };
