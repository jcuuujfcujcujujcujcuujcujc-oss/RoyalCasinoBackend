'use strict';

const service = require('./credit.service');
const { parseId } = require('../../utils/validation');

// GET /api/players/:id/credits - только чтение: депозитов, выводов и произвольного изменения баланса нет
async function getByPlayer(req, res) {
  res.status(200).json({ data: await service.getByPlayerId(parseId(req.params.id)) });
}

module.exports = { getByPlayer };
