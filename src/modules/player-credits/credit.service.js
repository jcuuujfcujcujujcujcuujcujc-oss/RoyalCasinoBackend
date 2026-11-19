'use strict';

const { PlayerCreditProfile, CreditTransaction, Player, sequelize } = require('../../models');
const { AppError, NotFoundError } = require('../../errors/AppError');
const { record } = require('../audit/audit.service');

// Учебный стартовый баланс нового игрока (виртуальные кредиты)
const STARTER_CREDITS = 1000;

// Вызывается внутри транзакции создания игрока: игрок и его профиль создаются атомарно
async function createStarterProfile(playerId, transaction) {
  const profile = await PlayerCreditProfile.create(
    { playerId, balance: String(STARTER_CREDITS) },
    { transaction }
  );
  await CreditTransaction.create(
    {
      playerId,
      type: 'GRANT',
      amount: `${STARTER_CREDITS}.00`,
      balanceAfter: `${STARTER_CREDITS}.00`,
      idempotencyKey: `starter:${playerId}`,
      createdBy: null,
    },
    { transaction }
  );
  return profile;
}

const MAX_CENTS = 99_999_999_999_999n;
function parseAmount(value) {
  if (typeof value !== 'string')
    throw new AppError(
      422,
      'amount передавайте строкой, чтобы сохранить десятичную точность',
      'VALIDATION_ERROR'
    );
  const raw = String(value);
  if (!/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(raw))
    throw new AppError(
      422,
      'amount должен быть числом с максимум 12 целыми и 2 дробными знаками',
      'VALIDATION_ERROR'
    );
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^-/, '').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents === 0n) throw new AppError(422, 'Корректировка не может быть нулевой', 'VALIDATION_ERROR');
  return negative ? -cents : cents;
}
const toCents = (value) => {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};
const fromCents = (value) => {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};

async function adjust({ playerId, amount, idempotencyKey, userId }) {
  const delta = parseAmount(amount);
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey))
    throw new AppError(400, 'Требуется корректный заголовок Idempotency-Key', 'IDEMPOTENCY_KEY_REQUIRED');
  return sequelize.transaction(async (transaction) => {
    const profile = await PlayerCreditProfile.findOne({
      where: { playerId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!profile) throw new NotFoundError(`Профиль кредитов игрока id=${playerId} не найден`);
    const existing = await CreditTransaction.findOne({ where: { playerId, idempotencyKey }, transaction });
    if (existing) {
      if (existing.type !== 'ADJUSTMENT' || toCents(existing.amount) !== delta)
        throw new AppError(
          409,
          'Idempotency-Key уже использован с другими параметрами',
          'IDEMPOTENCY_CONFLICT'
        );
      return existing;
    }
    const balanceAfterCents = toCents(profile.balance) + delta;
    if (balanceAfterCents < 0n)
      throw new AppError(422, 'Недостаточно виртуальных кредитов', 'INSUFFICIENT_CREDITS');
    if (balanceAfterCents > MAX_CENTS)
      throw new AppError(422, 'Баланс превышает допустимый предел', 'BALANCE_LIMIT_EXCEEDED');
    const amountString = fromCents(delta);
    const balanceAfter = fromCents(balanceAfterCents);
    profile.balance = balanceAfter;
    await profile.save({ transaction, fields: ['balance'] });
    const entry = await CreditTransaction.create(
      {
        playerId,
        type: 'ADJUSTMENT',
        amount: amountString,
        balanceAfter,
        idempotencyKey,
        createdBy: userId,
      },
      { transaction }
    );
    await record(
      {
        userId,
        action: 'CREDIT_ADJUSTMENT',
        entityType: 'PlayerCreditProfile',
        entityId: playerId,
        details: { amount: amountString, balanceAfter, idempotencyKey },
      },
      transaction
    );
    return entry;
  });
}

async function listTransactions(playerId, { page, limit }) {
  const player = await Player.findByPk(playerId, { attributes: ['id'] });
  if (!player) throw new NotFoundError(`Игрок с id=${playerId} не найден`);
  const { rows, count } = await CreditTransaction.findAndCountAll({
    where: { playerId },
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit,
    offset: (page - 1) * limit,
  });
  return { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
}

async function getByPlayerId(playerId) {
  const player = await Player.findByPk(playerId, { attributes: ['id'] });
  if (!player) throw new NotFoundError(`Игрок с id=${playerId} не найден`);
  const profile = await PlayerCreditProfile.findOne({ where: { playerId } });
  if (!profile) throw new NotFoundError(`Профиль кредитов игрока id=${playerId} не найден`);
  return profile;
}

module.exports = {
  STARTER_CREDITS,
  createStarterProfile,
  getByPlayerId,
  adjust,
  listTransactions,
  parseAmount,
};
