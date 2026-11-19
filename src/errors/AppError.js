'use strict';

class AppError extends Error {
  constructor(statusCode, message, code = 'APP_ERROR', details) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Некорректный запрос', details) {
    super(400, message, 'BAD_REQUEST', details);
  }
}

class ValidationError extends AppError {
  constructor(details, message = 'Ошибка валидации') {
    super(422, message, 'VALIDATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ресурс не найден') {
    super(404, message, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Конфликт состояния ресурса', details) {
    super(409, message, 'CONFLICT', details);
  }
}

module.exports = { AppError, BadRequestError, ValidationError, NotFoundError, ConflictError };
