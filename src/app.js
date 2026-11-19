'use strict';

const express = require('express');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const cors = require('./middleware/cors');
const rateLimits = require('./middleware/rateLimits');
const securityHeaders = require('./middleware/securityHeaders');
const docsCsp = require('./middleware/docsCsp');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi');
const env = require('./config/env');

const app = express();

if (env.trustProxy !== false) app.set('trust proxy', env.trustProxy);

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors);
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth/login', rateLimits.login);
app.use('/api/auth/login', rateLimits.loginAccount);
app.use('/api/auth/register', rateLimits.register);
app.use('/api', rateLimits.api);

if (env.enableDocs) {
  app.get('/api/openapi.json', (req, res) => res.json(openapi));
  app.use(
    '/api/docs',
    docsCsp,
    swaggerUi.serve,
    swaggerUi.setup(openapi, { explorer: true, customSiteTitle: 'Royal Casino API' })
  );
}
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
