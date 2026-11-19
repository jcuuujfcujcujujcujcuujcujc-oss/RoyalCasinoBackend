'use strict';

module.exports = {
  openapi: '3.0.3',
  info: { title: 'Royal Casino Backend API', version: '2.0.0', description: 'Учебный API каталога казино-игр и виртуальных кредитов.' },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Credentials: {
        type: 'object', required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 12, maxLength: 72, description: 'Пароль занимает 12–72 байта UTF-8.' },
          nickname: { type: 'string', minLength: 3, maxLength: 30 },
        },
      },
      Tokens: { type: 'object', properties: { data: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, user: { type: 'object' } } } } },
    },
    parameters: {
      page: { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
      limit: { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
    },
  },
  paths: {
    '/api/health': {
      get: { summary: 'Проверка доступности', responses: { 200: { description: 'Сервис доступен' } } },
    },
    '/api/auth/register': {
      post: {
        summary: 'Регистрация игрока',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'nickname'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 12, maxLength: 72 }, nickname: { type: 'string', minLength: 3, maxLength: 30 } } } } } },
        responses: { 201: { description: 'Пользователь создан' }, 409: { description: 'Email или никнейм заняты' }, 422: { description: 'Ошибка валидации' } },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Вход',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Credentials' } } } },
        responses: {
          200: { description: 'Пара токенов', content: { 'application/json': { schema: { $ref: '#/components/schemas/Tokens' } } } },
          401: { description: 'Неверные учётные данные' }, 429: { description: 'Слишком много попыток' },
        },
      },
    },
    '/api/auth/refresh': {
      post: { summary: 'Ротация refresh-токена', responses: { 200: { description: 'Новая пара токенов' }, 401: { description: 'Недействительный токен' } } },
    },
    '/api/auth/logout': {
      post: { summary: 'Отзыв refresh-токена', security: [{ bearerAuth: [] }], responses: { 204: { description: 'Сеанс закрыт' }, 401: { description: 'Требуется вход' } } },
    },
    '/api/auth/me': {
      get: { summary: 'Текущий пользователь', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Текущий пользователь' }, 401: { description: 'Требуется вход' } } },
    },
    '/api/games': {
      get: {
        summary: 'Публичный каталог игр',
        parameters: [
          { $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' },
          { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100 } },
          { in: 'query', name: 'category', schema: { type: 'string' } },
          { in: 'query', name: 'provider', schema: { type: 'string' } },
          { in: 'query', name: 'volatility', schema: { type: 'string' } },
          { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
          { in: 'query', name: 'sortBy', schema: { type: 'string' } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: { 200: { description: 'Страница каталога' }, 422: { description: 'Ошибка параметров' } },
      },
      post: { summary: 'Добавить игру (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Создано' }, 401: { description: 'Требуется вход' }, 403: { description: 'Недостаточно прав' } } },
    },
    '/api/games/{id}': {
      get: { summary: 'Получить игру', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Карточка игры' }, 404: { description: 'Не найдена' } } },
      put: { summary: 'Заменить игру (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } } },
      patch: { summary: 'Обновить игру (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } } },
      delete: { summary: 'Удалить игру (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 204: { description: 'Удалено' }, 403: { description: 'Только ADMIN' } } },
    },
    '/api/players': {
      get: { summary: 'Список игроков (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Список игроков' }, 401: { description: 'Требуется вход' }, 403: { description: 'Недостаточно прав' } } },
      post: { summary: 'Создать профиль игрока (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Создано' }, 409: { description: 'Дубликат' }, 422: { description: 'Ошибка валидации' } } },
    },
    '/api/players/{id}': {
      get: { summary: 'Получить собственный профиль или профиль (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Профиль' }, 404: { description: 'Не найден или не принадлежит пользователю' } } },
      patch: { summary: 'Изменить собственный профиль или профиль (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } } },
      put: { summary: 'Полная замена профиля (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Изменено' }, 403: { description: 'Только ADMIN' } } },
      delete: { summary: 'Удалить профиль (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 204: { description: 'Удалено' }, 403: { description: 'Только ADMIN' } } },
    },
    '/api/players/{id}/credits': {
      get: { summary: 'Прочитать собственный профиль кредитов или (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Только виртуальный баланс' }, 404: { description: 'Не найден или не принадлежит пользователю' } } },
    },
    '/api/categories': {
      get: { summary: 'Публичный список категорий', responses: { 200: { description: 'Список с пагинацией и поиском' }, 422: { description: 'Ошибка параметров' } } },
      post: { summary: 'Создать категорию (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Создано' }, 409: { description: 'Имя уже используется' }, 403: { description: 'Недостаточно прав' } } },
    },
    '/api/categories/{id}': {
      get: { summary: 'Получить категорию', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Категория' }, 404: { description: 'Не найдена' } } },
      put: { summary: 'Заменить категорию (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } } },
      patch: { summary: 'Обновить категорию (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } } },
      delete: { summary: 'Удалить категорию (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 204: { description: 'Удалено' }, 409: { description: 'Категория используется' } } },
    },
    '/api/casino/statistics': {
      get: { summary: 'Общая статистика (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Статистика' }, 403: { description: 'Недостаточно прав' } } },
    },
    '/api/casino/statistics/games': {
      get: { summary: 'Статистика игр (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Статистика игр' } } },
    },
    '/api/casino/statistics/players': {
      get: { summary: 'Статистика игроков (ADMIN, MANAGER)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Статистика игроков' } } },
    },
    '/api/admin/users': {
      get: { summary: 'Пользователи (ADMIN)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Список без хешей паролей' }, 403: { description: 'Только ADMIN' } } },
    },
    '/api/admin/audit-logs': {
      get: { summary: 'Журнал аудита (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }, { in: 'query', name: 'userId', schema: { type: 'integer' } }, { in: 'query', name: 'action', schema: { type: 'string' } }, { in: 'query', name: 'entityType', schema: { type: 'string' } }, { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } }, { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } }], responses: { 200: { description: 'Журнал действий' }, 403: { description: 'Только ADMIN' } } },
    },
    '/api/admin/users/{id}/active': {
      patch: { summary: 'Заблокировать или разблокировать пользователя (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 204: { description: 'Статус изменён, refresh tokens отозваны при блокировке' }, 409: { description: 'Нельзя заблокировать себя' } } },
    },
    '/api/admin/users/{id}/roles': {
      put: { summary: 'Назначить роли пользователя (ADMIN)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Роли назначены' }, 409: { description: 'Нельзя снять собственную роль ADMIN' } } },
    },
  },
};
