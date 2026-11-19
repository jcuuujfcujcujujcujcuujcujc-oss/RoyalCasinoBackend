'use strict';

const { Router } = require('express');
const controller = require('./gameCategory.controller');
const { authenticate, authorize } = require('../auth/auth.middleware');

const router = Router();

router.get('/', controller.list);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), controller.create);
router.get('/:id', controller.getById);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), controller.replace);
router.patch('/:id', authenticate, authorize('ADMIN', 'MANAGER'), controller.update);
router.delete('/:id', authenticate, authorize('ADMIN'), controller.remove);

module.exports = router;
