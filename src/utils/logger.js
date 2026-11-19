'use strict';

const crypto = require('node:crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');
const env = require('../config/env');

const logger = pino({
  level: env.logLevel,
  base: { service: 'royal-casino-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers.x-api-key',
      'req.body.password',
      'req.body.refreshToken',
      'res.headers.set-cookie',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err(error) {
      return { type: error?.name, code: error?.code, statusCode: error?.statusCode };
    },
  },
});

function requestLogger() {
  const httpLogger = pinoHttp({
    logger,
    genReqId(_req, res) {
      const requestId = crypto.randomUUID();
      res.setHeader('X-Request-Id', requestId);
      return requestId;
    },
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
  return (req, res, next) => {
    const path = req.url.split('?')[0];
    if (path === '/api/health' || path === '/api/health/ready') {
      req.id = crypto.randomUUID();
      res.setHeader('X-Request-Id', req.id);
      return next();
    }
    return httpLogger(req, res, next);
  };
}

module.exports = { logger, requestLogger };
