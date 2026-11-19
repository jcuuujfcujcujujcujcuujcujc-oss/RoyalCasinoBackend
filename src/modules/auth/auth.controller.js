'use strict';
const service = require('./auth.service');
const { AppError } = require('../../errors/AppError');
const body = (value) => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Ожидается JSON-объект', 'BAD_REQUEST'); return value; };
exports.register = async (req, res) => res.status(201).json({ data: await service.register(body(req.body)) });
exports.login = async (req, res) => res.json({ data: await service.login(body(req.body)) });
exports.refresh = async (req, res) => res.json({ data: await service.refresh(body(req.body).refreshToken) });
exports.logout = async (req, res) => { await service.logout(body(req.body).refreshToken, req.auth.id); res.status(204).end(); };
exports.me = async (req, res) => res.json({ data: req.auth });
