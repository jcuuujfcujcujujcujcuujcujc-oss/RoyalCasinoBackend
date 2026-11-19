'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE refresh_tokens
           ADD COLUMN family_id UUID,
           ADD COLUMN replaced_by INTEGER NULL REFERENCES refresh_tokens(id) ON DELETE SET NULL`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE refresh_tokens SET family_id = gen_random_uuid() WHERE family_id IS NULL`,
        { transaction }
      );
      await queryInterface.sequelize.query(`ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL`, {
        transaction,
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX refresh_tokens_family_idx ON refresh_tokens(family_id)`,
        { transaction }
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX refresh_tokens_family_idx', { transaction });
      await queryInterface.sequelize.query(
        `ALTER TABLE refresh_tokens DROP COLUMN replaced_by, DROP COLUMN family_id`,
        { transaction }
      );
    });
  },
};
