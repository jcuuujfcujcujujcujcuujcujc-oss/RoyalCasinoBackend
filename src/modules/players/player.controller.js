'use strict';

const service = require('./player.service');
const {
  validateCreate,
  validateReplace,
  validatePatch,
  validateListQuery,
  parseId,
} = require('./player.validation');

// Express 5 сам передаёт ошибки async-обработчиков в errorHandler

async function list(req, res) {
  res.status(200).json(await service.list(validateListQuery(req.query)));
}

async function getById(req, res) {
  res.status(200).json({ data: await service.getById(parseId(req.params.id)) });
}

async function create(req, res) {
  const player = await service.create(validateCreate(req.body), req.auth.id);
  res.status(201).location(`${req.baseUrl}/${player.id}`).json({ data: player });
}

async function replace(req, res) {
  const id = parseId(req.params.id);
  res.status(200).json({ data: await service.replace(id, validateReplace(req.body), req.auth.id) });
}

async function update(req, res) {
  const id = parseId(req.params.id);
  const data = validatePatch(req.body);
  const player = req.auth.roles.includes('ADMIN')
    ? await service.update(id, data, req.auth.id)
    : await service.updateOwned(id, data, req.auth.id);
  res.status(200).json({ data: player });
}

async function remove(req, res) {
  await service.remove(parseId(req.params.id), req.auth.id);
  res.status(204).send();
}

module.exports = { list, getById, create, replace, update, remove };
