'use strict';

const { NotFoundError } = require('../errors/AppError');

module.exports = (req, res, next) => {
  next(new NotFoundError(`Маршрут ${req.method} ${req.originalUrl} не найден`));
};
