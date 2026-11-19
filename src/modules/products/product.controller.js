'use strict';

const service = require('./product.service');
const {
  validateCreate,
  validateReplace,
  validatePatch,
  validateListQuery,
  parseId,
} = require('./product.validation');

// Express 5 сам передаёт ошибки async-обработчиков в errorHandler: try/catch не нужен

async function list(req, res) {
  const params = validateListQuery(req.query);
  res.status(200).json(await service.list(params));
}

async function getById(req, res) {
  const product = await service.getById(parseId(req.params.id));
  res.status(200).json({ data: product });
}

async function create(req, res) {
  const product = await service.create(validateCreate(req.body), req.auth.id);
  res.status(201).location(`${req.baseUrl}/${product.id}`).json({ data: product });
}

async function replace(req, res) {
  const id = parseId(req.params.id);
  const product = await service.replace(id, validateReplace(req.body), req.auth.id);
  res.status(200).json({ data: product });
}

async function update(req, res) {
  const id = parseId(req.params.id);
  const product = await service.update(id, validatePatch(req.body), req.auth.id);
  res.status(200).json({ data: product });
}

async function remove(req, res) {
  await service.remove(parseId(req.params.id), req.auth.id);
  res.status(204).send();
}

module.exports = { list, getById, create, replace, update, remove };
