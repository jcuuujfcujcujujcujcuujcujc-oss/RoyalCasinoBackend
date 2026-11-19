'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `CREATE TABLE credit_transactions (
          id BIGSERIAL PRIMARY KEY,
          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
          type VARCHAR(20) NOT NULL CHECK (type IN ('GRANT', 'ADJUSTMENT')),
          amount NUMERIC(14,2) NOT NULL,
          balance_after NUMERIC(14,2) NOT NULL CHECK (balance_after >= 0),
          idempotency_key VARCHAR(128) NOT NULL,
          created_by INTEGER NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT credit_transactions_idempotency_key UNIQUE(player_id, idempotency_key)
        )`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX credit_transactions_player_created_idx ON credit_transactions(player_id, created_at DESC, id DESC)`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE FUNCTION reject_credit_transaction_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN RAISE EXCEPTION 'credit_transactions are immutable' USING ERRCODE = '55000'; END $$`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE TRIGGER credit_transactions_immutable BEFORE UPDATE OR DELETE ON credit_transactions
         FOR EACH ROW EXECUTE FUNCTION reject_credit_transaction_mutation()`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `INSERT INTO credit_transactions(player_id,type,amount,balance_after,idempotency_key,created_at)
         SELECT player_id,'GRANT',balance,balance,'migration:opening:' || player_id,created_at
         FROM player_credit_profiles`,
        { transaction }
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP TABLE credit_transactions', { transaction });
      await queryInterface.sequelize.query('DROP FUNCTION reject_credit_transaction_mutation()', {
        transaction,
      });
    });
  },
};
