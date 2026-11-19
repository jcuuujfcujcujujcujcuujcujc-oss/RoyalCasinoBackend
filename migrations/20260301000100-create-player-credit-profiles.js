'use strict';

// Начальный учебный баланс существующих игроков (виртуальные кредиты, денежной ценности не имеют).
// Должен совпадать с STARTER_CREDITS в src/modules/player-credits/credit.service.js.
const STARTER_CREDITS = 1000;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql, replacements) => queryInterface.sequelize.query(sql, { transaction, replacements });

      await run(`
        CREATE TABLE player_credit_profiles (
          id         SERIAL PRIMARY KEY,
          player_id  INTEGER       NOT NULL,
          balance    NUMERIC(14,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT player_credit_profiles_player_key UNIQUE (player_id),
          CONSTRAINT player_credit_profiles_balance_non_negative CHECK (balance >= 0),
          CONSTRAINT player_credit_profiles_player_fkey
            FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);

      // Профили для уже существующих игроков
      await run(
        'INSERT INTO player_credit_profiles (player_id, balance) SELECT id, :starter FROM players',
        { starter: STARTER_CREDITS }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS player_credit_profiles');
  },
};
