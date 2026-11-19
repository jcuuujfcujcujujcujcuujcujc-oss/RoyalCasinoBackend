'use strict';

const helmet = require('helmet');

// Swagger UI currently embeds its bootstrap configuration and styles; permit inline code only on this route.
module.exports = helmet.contentSecurityPolicy({
  directives: {
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
  },
});
