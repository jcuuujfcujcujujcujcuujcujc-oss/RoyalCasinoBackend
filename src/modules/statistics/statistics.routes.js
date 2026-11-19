'use strict';

const { Router } = require('express');
const controller = require('./statistics.controller');
const { authenticate, authorize } = require('../auth/auth.middleware');

// Только чтение
const router = Router();
router.use(authenticate, authorize('ADMIN', 'MANAGER'));

router.get('/', controller.overview);
router.get('/games', controller.games);
router.get('/players', controller.players);

module.exports = router;
