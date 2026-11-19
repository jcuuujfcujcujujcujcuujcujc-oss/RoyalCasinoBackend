'use strict';

// Исходные значения products.category (CHECK products_category_valid) становятся начальными категориями,
// чтобы существующие продукты можно было связать с GameCategory без потери данных.
const LEGACY_CATEGORIES = ['slot', 'roulette', 'blackjack', 'poker', 'baccarat', 'other'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql, replacements) => queryInterface.sequelize.query(sql, { transaction, replacements });

      await run(`
        CREATE TABLE game_categories (
          id          SERIAL PRIMARY KEY,
          name        VARCHAR(100) NOT NULL,
          description TEXT,
          is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
          created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT game_categories_name_not_blank CHECK (length(btrim(name)) > 0)
        )
      `);
      // Имя уникально без учёта регистра
      await run('CREATE UNIQUE INDEX game_categories_name_lower_uidx ON game_categories (lower(name))');

      for (const name of LEGACY_CATEGORIES) {
        await run('INSERT INTO game_categories (name) VALUES (:name) ON CONFLICT DO NOTHING', { name });
      }
    });
  },

  async down(queryInterface) {
    // Безопасно только если products.category_id уже удалён (откат миграции 20260201000100 выполняется раньше)
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS game_categories');
  },
};
