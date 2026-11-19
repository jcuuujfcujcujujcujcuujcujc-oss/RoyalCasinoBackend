'use strict';

// Статические read-only SQL-запросы без пользовательского ввода (SQL-инъекции исключены).
// Вынесены в отдельный модуль, чтобы их можно было выполнить и проверить напрямую в PostgreSQL.
module.exports = {
  players: `
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE is_active)::int AS active,
           COUNT(*) FILTER (WHERE NOT is_active)::int AS inactive
      FROM players`,
  credits: `
    SELECT COALESCE(SUM(balance), 0) AS "totalVirtualCredits",
           COUNT(*)::int AS "profilesCount"
      FROM player_credit_profiles`,
  games: `
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE is_active)::int AS active,
           COUNT(*) FILTER (WHERE NOT is_active)::int AS inactive,
           COUNT(*) FILTER (WHERE category_id IS NULL)::int AS uncategorized
      FROM products`,
  gamesByCategory: `
    SELECT gc.id AS "categoryId", gc.name AS category, COUNT(p.id)::int AS "gamesCount"
      FROM game_categories gc
      LEFT JOIN products p ON p.category_id = gc.id
     GROUP BY gc.id, gc.name
     ORDER BY gc.name`,
  gamesByProvider: `
    SELECT provider, COUNT(*)::int AS "gamesCount",
           COUNT(*) FILTER (WHERE is_active)::int AS "activeGames"
      FROM products
     GROUP BY provider
     ORDER BY "gamesCount" DESC, provider`,
  gamesByVolatility: `
    SELECT volatility, COUNT(*)::int AS "gamesCount"
      FROM products
     GROUP BY volatility
     ORDER BY volatility`,
};
