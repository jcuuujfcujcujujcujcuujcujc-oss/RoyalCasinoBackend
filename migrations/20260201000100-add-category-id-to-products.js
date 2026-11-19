'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // Колонка nullable: существующие строки и клиенты, передающие только category, не ломаются
      await run('ALTER TABLE products ADD COLUMN category_id INTEGER');
      await run(`
        ALTER TABLE products
          ADD CONSTRAINT products_category_id_fkey
          FOREIGN KEY (category_id) REFERENCES game_categories (id)
          ON DELETE RESTRICT ON UPDATE CASCADE
      `);

      // Перенос данных: связываем продукты с категориями по значению устаревшего поля category.
      // Поле category НЕ удаляется и не меняется (обратная совместимость API).
      await run(`
        UPDATE products p
           SET category_id = gc.id
          FROM game_categories gc
         WHERE lower(gc.name) = p.category
      `);

      await run('CREATE INDEX products_category_id_idx ON products (category_id)');
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run('DROP INDEX IF EXISTS products_category_id_idx');
      await run('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey');
      await run('ALTER TABLE products DROP COLUMN IF EXISTS category_id');
    });
  },
};
