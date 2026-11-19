'use strict';

const service = require('./statistics.service');

async function overview(req, res) {
  res.status(200).json({ data: await service.overview() });
}
async function games(req, res) {
  res.status(200).json({ data: await service.gamesStatistics() });
}
async function players(req, res) {
  res.status(200).json({ data: await service.playersStatistics() });
}

module.exports = { overview, games, players };
