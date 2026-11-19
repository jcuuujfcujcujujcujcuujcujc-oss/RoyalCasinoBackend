'use strict';

const helmet = require('helmet');

// swagger-ui-express injects its bootstrap config and styles inline; this exception is confined to Swagger.
module.exports = helmet.contentSecurityPolicy({
  directives: {
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
  },
});
