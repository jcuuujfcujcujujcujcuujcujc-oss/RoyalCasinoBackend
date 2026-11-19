'use strict';

const cors = require('cors');
const env = require('../config/env');

module.exports = cors({
  origin: env.corsOrigin ? env.corsOrigin.split(',').map((value) => value.trim()) : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  maxAge: 600,
});
