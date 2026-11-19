'use strict';

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Royal Casino Backend API',
    version: '2.0.0',
    description: 'Учебный API каталога казино-игр и виртуальных кредитов.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      GameWrite: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 255 },
          description: { type: 'string', nullable: true, maxLength: 2000 },
          provider: { type: 'string', maxLength: 100 },
          category: { type: 'string' },
          categoryId: { type: 'integer', nullable: true },
          volatility: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          minBet: { type: 'number', minimum: 0.01 },
          maxBet: { type: 'number', minimum: 0.01 },
          rtp: { type: 'number', minimum: 0, maximum: 100 },
          tablesCount: { type: 'integer', minimum: 0, maximum: 1000 },
          isActive: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      CategoryWrite: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', nullable: true, maxLength: 1000 },
          isActive: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      PlayerWrite: {
        type: 'object',
        required: ['nickname', 'email'],
        properties: {
          nickname: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[A-Za-z0-9_.-]+$' },
          email: { type: 'string', format: 'email', maxLength: 254 },
          isActive: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      CreditProfile: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          playerId: { type: 'integer' },
          balance: { type: 'string', pattern: '^\\d{1,12}\\.\\d{2}$', example: '1000.00' },
        },
      },
      CreditTransaction: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          playerId: { type: 'integer' },
          type: { type: 'string', enum: ['GRANT', 'ADJUSTMENT'] },
          amount: { type: 'string', example: '-25.50' },
          balanceAfter: { type: 'string', example: '974.50' },
          idempotencyKey: { type: 'string' },
          createdBy: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreditAdjustment: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'string', pattern: '^-?(0|[1-9][0-9]{0,11})(\\.[0-9]{1,2})?$', example: '-25.50' },
        },
        additionalProperties: false,
      },
      Credentials: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: {
            type: 'string',
            minLength: 12,
            maxLength: 72,
            description: 'Пароль занимает 12–72 байта UTF-8.',
          },
          nickname: { type: 'string', minLength: 3, maxLength: 30 },
        },
      },
      Tokens: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              user: { type: 'object' },
            },
          },
        },
      },
    },
    parameters: {
      page: { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
      limit: {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Liveness: процесс API доступен без проверки БД',
        responses: { 200: { description: 'Сервис доступен' } },
      },
    },
    '/api/health/ready': {
      get: {
        summary: 'Readiness: API и PostgreSQL готовы принимать запросы',
        responses: {
          200: { description: 'База данных доступна' },
          503: {
            description: 'База данных недоступна',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'dependencies'],
                  properties: {
                    status: { type: 'string', enum: ['not_ready'] },
                    dependencies: {
                      type: 'object',
                      properties: { database: { type: 'string', enum: ['unavailable'] } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Регистрация игрока',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'nickname'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 12, maxLength: 72 },
                  nickname: { type: 'string', minLength: 3, maxLength: 30 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Пользователь, Player и стартовый виртуальный баланс созданы одной транзакцией',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Tokens' } } },
          },
          400: { description: 'Некорректное тело' },
          409: { description: 'Email или никнейм заняты' },
          422: { description: 'Ошибка валидации' },
          429: { description: 'Слишком много регистраций с IP' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Вход',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Credentials' } } },
        },
        responses: {
          200: {
            description: 'Пара токенов',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Tokens' } } },
          },
          401: { description: 'Неверные учётные данные' },
          422: { description: 'Некорректный email или пароль' },
          429: { description: 'Слишком много попыток' },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Ротация refresh-токена',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          200: { description: 'Новая пара токенов' },
          401: {
            description: 'Недействительный токен; reuse ранее отозванного токена отзывает его семейство',
          },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'Отзыв refresh-токена',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          204: { description: 'Сеанс закрыт' },
          400: { description: 'Некорректное тело' },
          401: { description: 'Требуется вход' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/auth/logout-all': {
      post: {
        summary: 'Отозвать все refresh-сессии текущего пользователя',
        security: [{ bearerAuth: [] }],
        responses: {
          204: { description: 'Все refresh-сессии отозваны' },
          401: { description: 'Требуется вход' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Текущий пользователь',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Текущий пользователь' }, 401: { description: 'Требуется вход' } },
      },
    },
    '/api/games': {
      get: {
        summary: 'Публичный каталог игр',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
          { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100 } },
          { in: 'query', name: 'category', schema: { type: 'string' } },
          { in: 'query', name: 'provider', schema: { type: 'string' } },
          { in: 'query', name: 'volatility', schema: { type: 'string' } },
          { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
          { in: 'query', name: 'sortBy', schema: { type: 'string' } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: { description: 'Страница каталога' },
          422: { description: 'Недопустимый page/limit/filter/sort' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
      post: {
        summary: 'Добавить игру (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/GameWrite' } } },
        },
        responses: {
          201: { description: 'Создано' },
          400: { description: 'Некорректное тело' },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
          409: { description: 'Игра с такими данными уже существует' },
          422: { description: 'Ошибка валидации или связи с категорией' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/games/{id}': {
      get: {
        summary: 'Получить игру',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Карточка игры' }, 404: { description: 'Не найдена' } },
      },
      put: {
        summary: 'Заменить игру (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/GameWrite' } } },
        },
        responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } },
      },
      patch: {
        summary: 'Обновить игру (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  provider: { type: 'string' },
                  category: { type: 'string' },
                  categoryId: { type: 'integer', nullable: true },
                  volatility: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                  minBet: { type: 'number' },
                  maxBet: { type: 'number' },
                  rtp: { type: 'number' },
                  tablesCount: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
                minProperties: 1,
                additionalProperties: false,
              },
            },
          },
        },
        responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } },
      },
      delete: {
        summary: 'Удалить игру (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Удалено' }, 403: { description: 'Только ADMIN' } },
      },
    },
    '/api/players': {
      get: {
        summary: 'Список игроков (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Список игроков' },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
        },
      },
      post: {
        summary: 'Создать профиль игрока (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PlayerWrite' } } },
        },
        responses: {
          201: { description: 'Создано' },
          400: { description: 'Некорректное тело' },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
          409: { description: 'Дубликат' },
          422: { description: 'Ошибка валидации' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/players/{id}': {
      get: {
        summary: 'Получить собственный профиль либо любой профиль (MANAGER, ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Профиль игрока' },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
          404: { description: 'Не найден или не принадлежит пользователю' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
      patch: {
        summary: 'Изменить собственный профиль (никнейм) либо любой профиль (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nickname: { type: 'string' },
                  email: { type: 'string', format: 'email', description: 'Только ADMIN' },
                  isActive: { type: 'boolean', description: 'Только ADMIN' },
                },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          200: { description: 'Изменено' },
          400: { description: 'Некорректное тело или id' },
          401: { description: 'Требуется вход' },
          403: { description: 'Изменение email/status доступно только ADMIN' },
          404: { description: 'Профиль чужого пользователя не раскрывается' },
          409: { description: 'Email или nickname заняты' },
          422: { description: 'Ошибка валидации' },
        },
      },
      put: {
        summary: 'Полная замена профиля (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PlayerWrite' } } },
        },
        responses: { 200: { description: 'Изменено' }, 403: { description: 'Только ADMIN' } },
      },
      delete: {
        summary: 'Удалить профиль (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Удалено' }, 403: { description: 'Только ADMIN' } },
      },
    },
    '/api/players/{id}/credits': {
      get: {
        summary: 'Прочитать баланс виртуальных кредитов (владелец, MANAGER, ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'Только виртуальный баланс; NUMERIC возвращается строкой',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/CreditProfile' } },
                },
              },
            },
          },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
          404: { description: 'Не найден или не принадлежит пользователю' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/players/{id}/credits/transactions': {
      get: {
        summary: 'История виртуальных кредитов (владелец, MANAGER, ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: { description: 'История проводок' },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
          404: { description: 'Игрок не найден' },
          422: { description: 'Некорректные параметры пагинации' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/players/{id}/credits/adjustments': {
      post: {
        summary: 'Корректировать только виртуальные кредиты (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' } },
          {
            in: 'header',
            name: 'Idempotency-Key',
            required: true,
            schema: { type: 'string', minLength: 8, maxLength: 128 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount'],
                properties: {
                  amount: { type: 'string', pattern: '^-?(0|[1-9][0-9]{0,11})(\\.[0-9]{1,2})?$' },
                },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          200: { description: 'Проводка создана или возвращена идемпотентно' },
          400: { description: 'Отсутствует допустимый Idempotency-Key' },
          401: { description: 'Требуется вход' },
          403: { description: 'Только ADMIN' },
          404: { description: 'Профиль игрока не найден' },
          409: { description: 'Idempotency-Key использован с другой суммой' },
          422: { description: 'Недостаточно виртуальных кредитов или некорректная сумма' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/categories': {
      get: {
        summary: 'Публичный список категорий',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
          { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100 } },
          { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
          { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['id', 'name', 'createdAt'] } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: { description: 'Список с пагинацией и поиском' },
          422: { description: 'Ошибка параметров' },
        },
      },
      post: {
        summary: 'Создать категорию (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryWrite' } } },
        },
        responses: {
          201: { description: 'Создано' },
          400: { description: 'Некорректное тело' },
          401: { description: 'Требуется вход' },
          409: { description: 'Имя уже используется' },
          403: { description: 'Недостаточно прав' },
          422: { description: 'Ошибка валидации' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/categories/{id}': {
      get: {
        summary: 'Получить категорию',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Категория' }, 404: { description: 'Не найдена' } },
      },
      put: {
        summary: 'Заменить категорию (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryWrite' } } },
        },
        responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } },
      },
      patch: {
        summary: 'Обновить категорию (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  isActive: { type: 'boolean' },
                },
                minProperties: 1,
                additionalProperties: false,
              },
            },
          },
        },
        responses: { 200: { description: 'Изменено' }, 403: { description: 'Недостаточно прав' } },
      },
      delete: {
        summary: 'Удалить категорию (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Удалено' }, 409: { description: 'Категория используется' } },
      },
    },
    '/api/casino/statistics': {
      get: {
        summary: 'Общая статистика (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Статистика' },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
          429: { description: 'Превышен общий лимит API' },
        },
      },
    },
    '/api/casino/statistics/games': {
      get: {
        summary: 'Статистика игр (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Статистика игр' },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
        },
      },
    },
    '/api/casino/statistics/players': {
      get: {
        summary: 'Статистика игроков (ADMIN, MANAGER)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Статистика игроков' },
          401: { description: 'Требуется вход' },
          403: { description: 'Недостаточно прав' },
        },
      },
    },
    '/api/admin/users': {
      get: {
        summary: 'Пользователи (ADMIN)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список без хешей паролей' }, 403: { description: 'Только ADMIN' } },
      },
    },
    '/api/admin/audit-logs': {
      get: {
        summary: 'Журнал аудита (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
          { in: 'query', name: 'userId', schema: { type: 'integer' } },
          { in: 'query', name: 'action', schema: { type: 'string' } },
          { in: 'query', name: 'entityType', schema: { type: 'string' } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { 200: { description: 'Журнал действий' }, 403: { description: 'Только ADMIN' } },
      },
    },
    '/api/admin/users/{id}/active': {
      patch: {
        summary: 'Заблокировать или разблокировать пользователя (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isActive'],
                properties: { isActive: { type: 'boolean' } },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          204: { description: 'Статус изменён, refresh tokens отозваны при блокировке' },
          409: { description: 'Нельзя заблокировать себя' },
        },
      },
    },
    '/api/admin/users/{id}/roles': {
      put: {
        summary: 'Назначить роли пользователя (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['roles'],
                properties: {
                  roles: {
                    type: 'array',
                    minItems: 1,
                    uniqueItems: true,
                    items: { type: 'string', enum: ['ADMIN', 'MANAGER', 'PLAYER'] },
                  },
                },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          200: { description: 'Роли назначены' },
          409: { description: 'Нельзя снять собственную роль ADMIN' },
        },
      },
    },
  },
};
