'use strict';

const service = require('./credit.service');
const { parseId } = require('../../utils/validation');
const { validateAdjustment, validateHistoryQuery } = require('./credit.validation');

// GET /api/players/:id/credits - только чтение: депозитов, выводов и произвольного изменения баланса нет
async function getByPlayer(req, res) {
  res.status(200).json({ data: await service.getByPlayerId(parseId(req.params.id)) });
}

async function adjust(req, res) {
  const input = validateAdjustment(req.body, req.get('Idempotency-Key'));
  const transaction = await service.adjust({
    playerId: parseId(req.params.id),
    ...input,
    userId: req.auth.id,
  });
  res.status(200).json({ data: transaction });
}

async function listTransactions(req, res) {
  const playerId = parseId(req.params.id);
  res.status(200).json(await service.listTransactions(playerId, validateHistoryQuery(req.query)));
}

module.exports = { getByPlayer, adjust, listTransactions };
