'use strict';

const { Router } = require('express');
const productRoutes = require('../modules/products/product.routes');
const gameCategoryRoutes = require('../modules/game-categories/gameCategory.routes');
const playerRoutes = require('../modules/players/player.routes');
const statisticsRoutes = require('../modules/statistics/statistics.routes');
const authRoutes = require('../modules/auth/auth.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const { sequelize } = require('../models');

const router = Router();

// Публичный маршрут, без авторизации
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'royal-casino-backend',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get('/health/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ready', dependencies: { database: 'ok' } });
  } catch {
    res.status(503).json({ status: 'not_ready', dependencies: { database: 'unavailable' } });
  }
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);

// Каталог казино-игр (Royal Casino Game Catalog)
// /games - основной casino-путь, /products - сохранён для обратной совместимости
router.use(['/games', '/products'], productRoutes);

// Категории игр (1 категория -> N игр)
// /categories - основной casino-путь, /game-categories - совместимость
router.use(['/categories', '/game-categories'], gameCategoryRoutes);

// Учебные профили игроков (без кошельков и ставок)
router.use('/players', playerRoutes);

// Статистика казино (только чтение)
router.use('/casino/statistics', statisticsRoutes);

module.exports = router;
