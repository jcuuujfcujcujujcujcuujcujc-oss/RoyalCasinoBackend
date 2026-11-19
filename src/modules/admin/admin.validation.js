'use strict';

const { Op } = require('sequelize');
const { AppError } = require('../../errors/AppError');
const { readPaging, finishQuery } = require('../../utils/validation');

const ROLE_CODES = ['ADMIN', 'MANAGER', 'PLAYER'];

function pagination(query) {
  const details = [];
  const result = readPaging(query, details);
  if ((result.page - 1) * result.limit > 1000000) {
    details.push({ field: 'page', message: 'смещение страницы не должно превышать 1000000 записей' });
  }
  return finishQuery(details, result);
}

function parseId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new AppError(400, 'Некорректный идентификатор', 'INVALID_ID');
  return id;
}

function validateActive(body) {
  if (!body || typeof body.isActive !== 'boolean' || Object.keys(body).some((key) => key !== 'isActive')) {
    throw new AppError(422, 'Передайте только булево поле isActive', 'VALIDATION_ERROR');
  }
  return body.isActive;
}

function validateRoles(body) {
  const roles = body?.roles;
  if (
    !body ||
    Object.keys(body).some((key) => key !== 'roles') ||
    !Array.isArray(roles) ||
    roles.length < 1 ||
    roles.some((code) => !ROLE_CODES.includes(code)) ||
    new Set(roles).size !== roles.length
  ) {
    throw new AppError(422, `Передайте непустой список ролей: ${ROLE_CODES.join(', ')}`, 'VALIDATION_ERROR');
  }
  return roles;
}

function auditQuery(query) {
  const { page, limit } = pagination(query);
  const where = {};
  for (const key of ['action', 'entityType']) {
    if (query[key] === undefined) continue;
    if (typeof query[key] !== 'string' || query[key].length < 1 || query[key].length > 80) {
      throw new AppError(422, `Некорректный ${key}`, 'VALIDATION_ERROR');
    }
    where[key] = query[key];
  }
  if (query.userId !== undefined) {
    if (
      typeof query.userId !== 'string' ||
      !/^\d+$/.test(query.userId) ||
      Number(query.userId) < 1 ||
      !Number.isSafeInteger(Number(query.userId))
    ) {
      throw new AppError(422, 'Некорректный userId', 'VALIDATION_ERROR');
    }
    where.userId = Number(query.userId);
  }
  for (const key of ['from', 'to']) {
    if (query[key] === undefined) continue;
    if (
      typeof query[key] !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/.test(query[key])
    ) {
      throw new AppError(422, `Некорректная дата ${key}`, 'VALIDATION_ERROR');
    }
    const date = new Date(query[key]);
    if (Number.isNaN(date.getTime())) throw new AppError(422, `Некорректная дата ${key}`, 'VALIDATION_ERROR');
    where.createdAt ||= {};
    where.createdAt[key === 'from' ? Op.gte : Op.lte] = date;
  }
  const from = where.createdAt?.[Op.gte];
  const to = where.createdAt?.[Op.lte];
  if (from && to && from > to) throw new AppError(422, 'from не может быть позже to', 'VALIDATION_ERROR');
  return { page, limit, where };
}

module.exports = { pagination, parseId, validateActive, validateRoles, auditQuery };
