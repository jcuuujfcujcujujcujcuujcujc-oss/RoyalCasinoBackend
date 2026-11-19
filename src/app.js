'use strict';

const express = require('express');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi');
const env = require('./config/env');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.corsOrigin ? env.corsOrigin.split(',').map((value) => value.trim()) : false, methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization'], maxAge: 600 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Слишком много попыток входа; повторите позже' } } }));
app.use('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

// Базовые защитные заголовки (без внешних зависимостей)
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '100kb' }));

app.get('/api/openapi.json', (req, res) => res.json(openapi));
// Swagger UI injects an inline bootstrap script and styles; permit those only on its documentation route.
const docsCsp = helmet.contentSecurityPolicy({
  directives: { scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'] },
});
app.use('/api/docs', docsCsp, swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true, customSiteTitle: 'Royal Casino API' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
