# Royal Casino Backend (учебный проект)

Каталог казино-игр и управление игроками. Node.js (>=22), Express 5, PostgreSQL, Sequelize 6, dotenv, CommonJS.

> **Учебный проект.** Используются только **виртуальные кредиты без денежной ценности**. Реальные деньги,
> платежи, пополнение и вывод средств, платёжные шлюзы в проекте отсутствуют. Игры на деньги предназначены
> только для лиц 18+ и требуют лицензии; этот код не является лицензированным игровым продуктом.

## Предметная область

| Casino-термин               | Реализация                 | Внутреннее имя (совместимость)                                                    |
| --------------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| Casino Game (игра каталога) | `/api/games`               | модуль `products`, таблица `products`, алиас `/api/products`                      |
| Casino Category             | `/api/categories`          | модуль `game-categories`, таблица `game_categories`, алиас `/api/game-categories` |
| Casino Player               | `/api/players`             | модуль `players`, таблица `players`                                               |
| Virtual Credits             | `/api/players/:id/credits` | модуль `player-credits`, таблица `player_credit_profiles`                         |
| Casino Statistics           | `/api/casino/statistics`   | модуль `statistics` (только чтение)                                               |

Внутренние идентификаторы (`Product`, `GameCategory`) сохранены намеренно: переименование не даёт технической выгоды
и ломало бы существующие миграции и клиентов. Casino-терминология применена в публичном API и документации.

### Игра (Casino Game)

| Поле                     | Тип             | Правила                                                                                                                         |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | integer         | генерируется БД                                                                                                                 |
| `name`                   | string          | обязательное, 1..255                                                                                                            |
| `description`            | string \| null  | до 2000                                                                                                                         |
| `provider`               | string          | 1..100, по умолчанию `Unknown`                                                                                                  |
| `category`               | string          | тип игры: `slot`, `roulette`, `blackjack`, `poker`, `baccarat`, `dice`, `lottery`, `other` (обязательно, если нет `categoryId`) |
| `categoryId`             | integer \| null | ссылка на категорию (FK)                                                                                                        |
| `volatility`             | string          | `LOW` \| `MEDIUM` \| `HIGH` (регистр входа не важен), по умолчанию `MEDIUM`                                                     |
| `minBet`, `maxBet`       | number          | виртуальные кредиты, 0.01..1 000 000, до 2 знаков, `minBet <= maxBet`                                                           |
| `rtp`                    | number          | 0..100 (% возврата), до 2 знаков                                                                                                |
| `tablesCount`            | integer         | 0..1000                                                                                                                         |
| `isActive`               | boolean         | доступность игры, по умолчанию `true`                                                                                           |
| `createdAt`, `updatedAt` | datetime        |                                                                                                                                 |

Правило `minBet <= maxBet` проверяется в валидации, в сервисе для PATCH (с блокировкой строки), в модели и CHECK в БД.
`category` и `categoryId` согласованы: подробности в `docs/API.md`.

### Игрок и виртуальные кредиты

`Player`: `id, nickname (уникален без учёта регистра), email (уникален), isActive, userId (nullable unique FK), createdAt, updatedAt`.
Пароль хранится только как `passwordHash` в таблице `users`, не в Player; API никогда не возвращает хеш. Подробнее: раздел «Аутентификация и первичный администратор».
При создании игрока в той же транзакции создаётся профиль кредитов со стартовым балансом 1000 виртуальных кредитов.
Баланс нельзя изменить через API (поле не входит в разрешённые для PATCH/PUT); отрицательный баланс запрещён CHECK в БД.
Операций начисления/списания пока нет — это осознанное ограничение (см. `docs/laboratory-report/report.md`).

## Быстрый старт

```bash
node -v                       # ожидается v22+
npm install
cp .env.example .env          # впишите свой DB_PASSWORD
# заполните JWT_SECRET приватным случайным значением (32+ байта)
npx sequelize-cli db:create   # или: createdb universal_backend
npm run db:migrate
npm run dev                   # или: npm start
```

## Миграции

```bash
npm run db:migrate            # применить
npm run db:migrate:status     # статус
npm run db:migrate:undo       # откатить последнюю
```

| Миграция                                       | Изменение                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `20260101000000-create-products`               | таблица `products`                                                                                       |
| `20260201000000-create-game-categories`        | `game_categories`, начальные категории                                                                   |
| `20260201000100-add-category-id-to-products`   | `products.category_id` + FK `ON DELETE RESTRICT`, перенос данных                                         |
| `20260201000200-create-players`                | `players`, уникальность nickname/email                                                                   |
| `20260301000000-casino-game-fields`            | `provider`, `volatility`, типы `dice`/`lottery`, RTP 0..100, категории dice/lottery                      |
| `20260301000100-create-player-credit-profiles` | `player_credit_profiles`, FK `ON DELETE CASCADE`, CHECK `balance >= 0`, стартовые профили                |
| `20260401000000-add-auth-audit`                | `users`, `roles`, `user_roles`, hashed `refresh_tokens`, `audit_logs`, nullable unique `players.user_id` |

Схема меняется только миграциями; `sequelize.sync()` не используется.

## Тесты

```bash
npm run test:unit             # валидация, errorHandler, HTTP-проверки без БД
# Интеграционные тесты (HTTP + PostgreSQL). БД ОБЯЗАТЕЛЬНО отдельная, имя оканчивается на _test:
#   DB_NAME=universal_backend_test, затем:
NODE_ENV=test npm run db:migrate
npm run test:integration      # очищает таблицы тестовой БД!
npm test                      # всё (интеграционные пропускаются без тестовой БД)
```

Проверки качества:

```bash
npm run lint
npm run format:check
npm run format                  # применить форматирование Prettier
```

ESLint и Prettier — только инструменты разработки; `@eslint/js` и `globals` подключают рекомендуемые правила и Node.js globals для flat config. `pg` и `pg-hstore` нужны Sequelize PostgreSQL dialect и загружаются динамически, поэтому статический depcheck может ошибочно пометить их неиспользуемыми.

## Эндпоинты (подробно с примерами: `docs/API.md`)

```
GET    /api/health

GET                   /api/games            ?page&limit&sortBy&order&search&category&categoryId&provider&volatility&isActive (public)
POST|PUT|PATCH        /api/games[/:id]      (ADMIN, MANAGER)
DELETE                /api/games/:id        (ADMIN)

GET                   /api/categories      (public; search, pagination)
POST|PUT|PATCH        /api/categories[/:id] (ADMIN, MANAGER)
DELETE                /api/categories/:id   (ADMIN; 409, если в категории есть игры)

POST                  /api/auth/register     (создаёт PLAYER + профиль и 1000 кредитов в транзакции)
POST                  /api/auth/login        (5 попыток за 15 минут на IP)
POST                  /api/auth/refresh      (ротация refresh token)
POST                  /api/auth/logout       (Bearer + отзыв refresh token)
GET                   /api/auth/me           (Bearer)
GET|POST              /api/players           (ADMIN, MANAGER)
GET|PATCH             /api/players/:id       (только свой профиль или ADMIN)
GET                   /api/players/:id/credits (только свой профиль или ADMIN)
PUT|DELETE            /api/players/:id       (ADMIN)

GET  /api/casino/statistics[/*]             (ADMIN, MANAGER)
GET  /api/admin/users                       (ADMIN, без passwordHash)
PUT  /api/admin/users/:id/roles             (ADMIN)
PATCH /api/admin/users/:id/active           (ADMIN)
GET  /api/admin/audit-logs                  (ADMIN)
GET  /api/docs                              (Swagger UI; Bearer Authorize)
GET  /api/openapi.json                      (OpenAPI 3.0)
```

Алиасы для обратной совместимости: `/api/products[/:id]` = `/api/games`, `/api/game-categories[/:id]` = `/api/categories`.

Коды ответов: 200, 201 (с `Location`), 204, 400 (битый JSON, неверный id), 404, 409 (дубликат, категория с играми,
нарушение связей), 413, 415, 422 (валидация и CHECK БД), 503 (БД недоступна), 500.

Формат ошибки:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ошибка валидации",
    "details": [{ "field": "maxBet", "message": "не может быть меньше minBet" }]
  }
}
```

## Структура

- `src/app.js`, `src/server.js` - приложение и точка входа
- `src/config/`, `src/errors/`, `src/middleware/` - конфигурация, ошибки, обработчики
- `src/models/index.js` - регистрация моделей и ассоциаций
- `src/modules/products/` (игры), `game-categories/`, `players/`, `player-credits/`, `statistics/` - model, validation, service, controller, routes
- `src/utils/validation.js` - общие функции валидации
- `migrations/` - версионируемые изменения схемы; `tests/` - тесты на `node:test`; `docs/` - документация и отчёт

## Ограничения и модель виртуальных кредитов

Кредиты являются учебными виртуальными единицами и не имеют денежной ценности. Не реализованы платежи, депозиты, вывод средств, кошельки или платёжные провайдеры. Администратор может проводить виртуальную корректировку; все операции пишутся в неизменяемый ledger.
Для реального игрового сервиса потребуются сертифицированный ГСЧ, KYC/AML, лимиты ответственной игры и лицензирование.

## Аутентификация и первичный администратор

Скопируйте `.env.example` в `.env`, задайте PostgreSQL-параметры и замените пример `JWT_SECRET` случайным секретом длиной не менее 32 байт. Его можно получить командой `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Не публикуйте этот секрет.

После миграций создайте первого администратора. PowerShell запросит пароль отдельно, чтобы значение не попало в историю команды:

```powershell
$env:ADMIN_EMAIL = Read-Host 'Email администратора'
$env:ADMIN_PASSWORD = Read-Host 'Пароль администратора'
npm run admin:bootstrap
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

Bootstrap не содержит встроенного пароля; пароль должен занимать 12–72 байта UTF-8. Публичная регистрация назначает только `PLAYER`. Роли `ADMIN`, `MANAGER`, `PLAYER` создаёт миграция; операции назначения ролей и блокировки доступны только ADMIN. Access Token действует 15 минут, refresh token — 7 дней по умолчанию; значения настраиваются в окружении. Refresh токены в БД хранятся только как SHA-256 хеши и ротируются при обновлении.

Публичны только чтение каталога игр/категорий, health и auth-регистрация/вход/обновление. Игрок получает только собственный профиль и кредитный профиль. Изменения игр и категорий требуют `ADMIN` или `MANAGER`, удаление — `ADMIN`. `/api/docs` содержит спецификацию OpenAPI и кнопку Bearer Authorize.

За reverse proxy задайте `TRUST_PROXY` как число доверенных переходов или список доверенных адресов; по умолчанию proxy-заголовки не используются. Лимит login считает только неуспешные запросы по IP и нормализованному email. `ENABLE_DOCS` включает Swagger/OpenAPI; в production документация выключена по умолчанию. Refresh-token replay отзывает всё семейство, а `/api/auth/logout-all` отзывает все активные refresh-сессии пользователя. Игрок не может менять email через Player PATCH; это доступно только администратору.

Списки каталога принимают `search` (1–100 символов), фильтры, сортировку и пагинацию (`limit` максимум 100, смещение максимум 1 000 000). Символы `%` и `_` в поиске считаются обычными символами. Админский журнал поддерживает `userId`, `action`, `entityType`, `from`, `to`, `page`, `limit`.

Полный отчёт по внедрению лабораторной № 3: `docs/laboratory-report/report.md`.
