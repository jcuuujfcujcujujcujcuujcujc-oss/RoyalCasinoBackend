'use strict';

const service = require('./admin.service');
const validation = require('./admin.validation');

async function listUsers(req, res) {
  res.json(await service.listUsers(validation.pagination(req.query)));
}

async function updateActive(req, res) {
  await service.updateActive({
    actorId: req.auth.id,
    userId: validation.parseId(req.params.id),
    isActive: validation.validateActive(req.body),
  });
  res.status(204).end();
}

async function assignRoles(req, res) {
  const data = await service.assignRoles({
    actorId: req.auth.id,
    userId: validation.parseId(req.params.id),
    roleCodes: validation.validateRoles(req.body),
  });
  res.json({ data });
}

async function listAuditLogs(req, res) {
  res.json(await service.listAuditLogs(validation.auditQuery(req.query)));
}

module.exports = { listUsers, updateActive, assignRoles, listAuditLogs };
