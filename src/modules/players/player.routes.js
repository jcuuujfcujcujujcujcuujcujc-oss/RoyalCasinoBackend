'use strict';

const { Router } = require('express');
const controller = require('./player.controller');
const credits = require('../player-credits/credit.controller');
const { authenticate, authorize, ownerOrAdmin, preventOwnStatusChange } = require('../auth/auth.middleware');

const router = Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'MANAGER'), controller.list);
router.post('/', authorize('ADMIN', 'MANAGER'), controller.create);
router.get('/:id/credits', ownerOrAdmin, credits.getByPlayer);
router.get('/:id', ownerOrAdmin, controller.getById);
router.put('/:id', authorize('ADMIN'), controller.replace);
router.patch('/:id', ownerOrAdmin, preventOwnStatusChange, controller.update);
router.delete('/:id', authorize('ADMIN'), controller.remove);

module.exports = router;
