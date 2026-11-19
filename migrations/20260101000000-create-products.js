'use strict';

const CATEGORIES = ['slot', 'roulette', 'blackjack', 'poker', 'baccarat', 'other'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      const categoryList = CATEGORIES.map((c) => `'${c}'`).join(', ');

      // products - каталог игровых продуктов казино (виртуальные кредиты, без реальных денег)
      await run(`
        CREATE TABLE products (
          id           SERIAL PRIMARY KEY,
          name         VARCHAR(255) NOT NULL,
          description  TEXT,
          category     VARCHAR(20)   NOT NULL,
          min_bet      NUMERIC(10,2) NOT NULL DEFAULT 0.10,
          max_bet      NUMERIC(10,2) NOT NULL,
          rtp          NUMERIC(5,2)  NOT NULL,
          tables_count INTEGER       NOT NULL DEFAULT 0,
          is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
          created_at   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT products_name_not_blank       CHECK (length(btrim(name)) > 0),
          CONSTRAINT products_category_valid       CHECK (category IN (${categoryList})),
          CONSTRAINT products_min_bet_positive     CHECK (min_bet >= 0.01),
          CONSTRAINT products_bet_range            CHECK (max_bet >= min_bet),
          CONSTRAINT products_rtp_range            CHECK (rtp >= 50 AND rtp <= 99.99),
          CONSTRAINT products_tables_non_negative  CHECK (tables_count >= 0)
        )
      `);

      await run('CREATE INDEX products_category_active_idx ON products (category, is_active)');
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS products');
  },
};
