'use strict';

const { sequelize } = require('../../models');
const q = require('./statistics.queries');

const rows = async (sql) => await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
const one = async (sql) => (await rows(sql))[0];

async function playersStatistics() {
  const [players, credits] = await Promise.all([one(q.players), one(q.credits)]);
  return {
    totalPlayers: players.total,
    activePlayers: players.active,
    inactivePlayers: players.inactive,
    // Сумма виртуальных кредитов: денежной ценности не имеет
    totalVirtualCredits: Number(credits.totalVirtualCredits),
    creditProfiles: credits.profilesCount,
  };
}

async function gamesStatistics() {
  const [games, byCategory, byProvider, byVolatility] = await Promise.all([
    one(q.games),
    rows(q.gamesByCategory),
    rows(q.gamesByProvider),
    rows(q.gamesByVolatility),
  ]);
  return {
    totalGames: games.total,
    activeGames: games.active,
    inactiveGames: games.inactive,
    gamesWithoutCategory: games.uncategorized,
    byCategory,
    byProvider,
    byVolatility,
  };
}

async function overview() {
  const [players, games] = await Promise.all([playersStatistics(), gamesStatistics()]);
  return { players, games };
}

module.exports = { overview, playersStatistics, gamesStatistics };
