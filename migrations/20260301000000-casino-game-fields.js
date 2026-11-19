'use strict';

const OLD_CATEGORIES = ['slot', 'roulette', 'blackjack', 'poker', 'baccarat', 'other'];
const NEW_CATEGORIES = ['slot', 'roulette', 'blackjack', 'poker', 'baccarat', 'dice', 'lottery', 'other'];
const list = (items) => items.map((c) => `'${c}'`).join(', ');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // Новые поля с DEFAULT: существующие записи получают 'Unknown' / 'MEDIUM' (данные не теряются)
      await run("ALTER TABLE products ADD COLUMN provider VARCHAR(100) NOT NULL DEFAULT 'Unknown'");
      await run("ALTER TABLE products ADD COLUMN volatility VARCHAR(6) NOT NULL DEFAULT 'MEDIUM'");
      await run(
        'ALTER TABLE products ADD CONSTRAINT products_provider_not_blank CHECK (length(btrim(provider)) > 0)'
      );
      await run(
        `ALTER TABLE products ADD CONSTRAINT products_volatility_valid CHECK (volatility IN ('LOW', 'MEDIUM', 'HIGH'))`
      );

      // Новые типы игр: dice, lottery. Старый набор - подмножество нового, поэтому все строки остаются валидными.
      await run('ALTER TABLE products DROP CONSTRAINT products_category_valid');
      await run(
        `ALTER TABLE products ADD CONSTRAINT products_category_valid CHECK (category IN (${list(NEW_CATEGORIES)}))`
      );

      // RTP: допустимый диапазон 0..100 (было 50..99.99 - шире, значит старые строки валидны)
      await run('ALTER TABLE products DROP CONSTRAINT products_rtp_range');
      await run('ALTER TABLE products ADD CONSTRAINT products_rtp_range CHECK (rtp >= 0 AND rtp <= 100)');

      await run('CREATE INDEX products_provider_idx ON products (lower(provider))');

      // Категории для новых типов игр (если такая категория уже создана вручную - не трогаем)
      await run("INSERT INTO game_categories (name) VALUES ('dice'), ('lottery') ON CONFLICT DO NOTHING");
    });
  },

  // Откат намеренно не удаляет и не подменяет данные: если есть игры dice/lottery или RTP вне 50..99.99,
  // добавление старых ограничений завершится ошибкой, транзакция откатится, данные останутся целыми.
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run('DROP INDEX IF EXISTS products_provider_idx');
      await run('ALTER TABLE products DROP CONSTRAINT products_rtp_range');
      await run('ALTER TABLE products ADD CONSTRAINT products_rtp_range CHECK (rtp >= 50 AND rtp <= 99.99)');
      await run('ALTER TABLE products DROP CONSTRAINT products_category_valid');
      await run(
        `ALTER TABLE products ADD CONSTRAINT products_category_valid CHECK (category IN (${list(OLD_CATEGORIES)}))`
      );
      await run('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_volatility_valid');
      await run('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_provider_not_blank');
      await run('ALTER TABLE products DROP COLUMN IF EXISTS volatility');
      await run('ALTER TABLE products DROP COLUMN IF EXISTS provider');
      // Пустые (неиспользуемые) категории dice/lottery, добавленные миграцией, убираем
      await run(`
        DELETE FROM game_categories gc
         WHERE lower(gc.name) IN ('dice', 'lottery')
           AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = gc.id)
      `);
    });
  },
};
