'use strict';

const { Router } = require('express');
const controller = require('./admin.controller');
const { authenticate, authorize } = require('../auth/auth.middleware');

const router = Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/users', controller.listUsers);
router.patch('/users/:id/active', controller.updateActive);
router.put('/users/:id/roles', controller.assignRoles);
router.get('/audit-logs', controller.listAuditLogs);

module.exports = router;
