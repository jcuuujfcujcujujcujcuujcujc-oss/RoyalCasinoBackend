'use strict';

const { PlayerCreditProfile, Player } = require('../../models');
const { NotFoundError } = require('../../errors/AppError');

// Учебный стартовый баланс нового игрока (виртуальные кредиты)
const STARTER_CREDITS = 1000;

// Вызывается внутри транзакции создания игрока: игрок и его профиль создаются атомарно
function createStarterProfile(playerId, transaction) {
  return PlayerCreditProfile.create({ playerId, balance: STARTER_CREDITS }, { transaction });
}

async function getByPlayerId(playerId) {
  const player = await Player.findByPk(playerId, { attributes: ['id'] });
  if (!player) throw new NotFoundError(`Игрок с id=${playerId} не найден`);
  const profile = await PlayerCreditProfile.findOne({ where: { playerId } });
  if (!profile) throw new NotFoundError(`Профиль кредитов игрока id=${playerId} не найден`);
  return profile;
}

module.exports = { STARTER_CREDITS, createStarterProfile, getByPlayerId };
