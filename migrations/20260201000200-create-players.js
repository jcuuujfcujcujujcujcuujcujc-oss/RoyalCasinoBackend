'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // players - учебный профиль игрока. Баланса, платежей и ставок здесь нет намеренно.
      await run(`
        CREATE TABLE players (
          id         SERIAL PRIMARY KEY,
          nickname   VARCHAR(30)  NOT NULL,
          email      VARCHAR(254) NOT NULL,
          is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT players_nickname_length CHECK (char_length(nickname) BETWEEN 3 AND 30),
          CONSTRAINT players_email_lowercase CHECK (email = lower(email)),
          CONSTRAINT players_email_not_blank CHECK (length(btrim(email)) > 0),
          CONSTRAINT players_email_key UNIQUE (email)
        )
      `);
      // Никнейм уникален без учёта регистра ("Alice" и "alice" - один и тот же ник)
      await run('CREATE UNIQUE INDEX players_nickname_lower_uidx ON players (lower(nickname))');
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS players');
  },
};
