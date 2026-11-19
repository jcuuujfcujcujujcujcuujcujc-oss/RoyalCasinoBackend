# Royal Casino Backend — API

Все суммы — **виртуальные кредиты** без денежной ценности. Тела запросов и ответов — JSON.
Примеры ниже показывают формат; это иллюстрации, а не записанные логи выполнения.

## Игры (`/api/games`, алиас `/api/products`)

### Создание — `POST /api/games` → 201, `Location: /api/games/{id}`

```json
{
  "name": "Royal Fortune Slots",
  "description": "Educational virtual casino slot game",
  "provider": "Royal Games",
  "category": "slot",
  "volatility": "HIGH",
  "minBet": 0.1,
  "maxBet": 100,
  "rtp": 96.5,
  "tablesCount": 0,
  "isActive": true
}
```

Ответ:

```json
{
  "data": {
    "id": 1,
    "name": "Royal Fortune Slots",
    "description": "Educational virtual casino slot game",
    "provider": "Royal Games",
    "category": "slot",
    "categoryId": 1,
    "volatility": "HIGH",
    "minBet": 0.1,
    "maxBet": 100,
    "rtp": 96.5,
    "tablesCount": 0,
    "isActive": true,
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

Связь с категорией:

- передан только `category` → `categoryId` подбирается по имени категории (без учёта регистра);
- передан `categoryId` → `category` выводится из имени категории (`other`, если имя не из списка типов); `category`
  в запросе, если указано, должно совпадать, иначе 422; несуществующий `categoryId` → 422;
- `PATCH {"categoryId": null}` снимает связь (поле `category` остаётся).

### Список — `GET /api/games`

Параметры: `page` (1..1000000), `limit` (1..100, по умолчанию 20), `sortBy` (`id,name,provider,volatility,category,categoryId,minBet,maxBet,rtp,createdAt`),
`order` (`asc|desc`), `category`, `categoryId`, `provider` (без учёта регистра), `volatility`, `isActive`.

```
GET /api/games?provider=royal%20games&volatility=high&isActive=true&sortBy=rtp&order=desc&page=1&limit=10
```

```json
{
  "data": [{ "id": 1, "name": "Royal Fortune Slots", "…": "…" }],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### Остальное

`GET /api/games/:id` (200/404), `PUT` (полная замена: необязательные поля сбрасываются к значениям по умолчанию),
`PATCH` (частичное: `minBet` сверяется с сохранённым `maxBet` и наоборот → 422), `DELETE` (204).

Пример ошибки валидации (422):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ошибка валидации",
    "details": [
      { "field": "volatility", "message": "допустимо: LOW, MEDIUM, HIGH" },
      { "field": "rtp", "message": "должно быть в диапазоне 0..100" }
    ]
  }
}
```

## Категории (`/api/categories`, алиас `/api/game-categories`)

`POST {"name": "Slots", "description": "Игровые автоматы"}` → 201. Имя уникально без учёта регистра (дубликат → 409).
Поля: `id, name (1..100), description, isActive, createdAt, updatedAt`. Фильтр списка: `isActive`; сортировка: `id,name,createdAt`.
Начальные категории: `slot, roulette, blackjack, poker, baccarat, dice, lottery, other`.

`DELETE /api/categories/{id}` для категории с играми:

```json
{ "error": { "code": "CONFLICT", "message": "Категория используется в играх (2): удаление невозможно" } }
```

→ 409 (проверка в приложении + внешний ключ `ON DELETE RESTRICT`).

## Игроки (`/api/players`)

```json
{ "nickname": "HighRoller", "email": "High.Roller@Royal.test" }
```

→ 201, `email` хранится в нижнем регистре. `nickname`: 3..30, `[A-Za-z0-9_.-]`. Дубликат nickname (любой регистр) или email → 409
с `details: [{ "field": "nickname" | "email", "message": "значение уже используется" }]`.
`passwordHash` и баланс в ответах/запросах отсутствуют.

### Виртуальные кредиты — `GET /api/players/:id/credits`

```json
{ "data": { "id": 1, "playerId": 1, "balance": 1000, "createdAt": "…", "updatedAt": "…" } }
```

Только чтение. Стартовый баланс — 1000 виртуальных кредитов (учебная константа `STARTER_CREDITS`).
Пополнения, выводов и изменения баланса через PATCH нет.

## Статистика (только чтение)

- `GET /api/casino/statistics` → `{ data: { players: {...}, games: {...} } }`
- `GET /api/casino/statistics/players` → `totalPlayers, activePlayers, inactivePlayers, totalVirtualCredits, creditProfiles`
- `GET /api/casino/statistics/games` → `totalGames, activeGames, inactiveGames, gamesWithoutCategory, byCategory[], byProvider[], byVolatility[]`

## Health

`GET /api/health` → `{"status":"ok","service":"royal-casino-backend","uptime":…,"timestamp":"…"}`

## Аутентификация и роли

### Регистрация — `POST /api/auth/register`

```json
{ "email": "player@example.test", "password": "StrongPassword123!", "nickname": "HighRoller" }
```

Пароль занимает от 12 до 72 байт UTF-8 и хранится только как bcrypt-хеш. Регистрация назначает только роль `PLAYER`, связывает пользователя с `Player`, создаёт профиль виртуальных кредитов и audit log одной транзакцией. Клиент не может прислать `role`, `isActive` или `passwordHash`.

### Вход, обновление и выход

- `POST /api/auth/login` → 200 с Access и Refresh Token; неверная пара → 401.
- `POST /api/auth/refresh` с `{ "refreshToken": "…" }` → новая пара токенов; прежний refresh отзывается и повторно не принимается.
- `POST /api/auth/logout` с Bearer Access Token и JSON `refreshToken` → 204; отзыв относится к текущему пользователю.
- `GET /api/auth/me` → идентификатор, email, роли и связанный ID игрока.
- Access Token по умолчанию действует 15 минут, Refresh Token — 7 дней. В БД хранится хеш refresh-токена; секрет JWT задаётся только через `JWT_SECRET`.

### Матрица ролей

| Роль      | Возможности                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------ |
| `PLAYER`  | Публичный каталог; чтение и изменение собственного профиля; чтение собственного профиля кредитов |
| `MANAGER` | Каталог игр/категорий, управление играми и категориями, список игроков, статистика               |
| `ADMIN`   | Полный доступ, удаление игр/категорий, управление ролями и блокировкой пользователей, аудит      |

Списки игроков и финансовая статистика требуют Bearer-токен. Чужой профиль игроку отвечает 404. Поля `passwordHash`, токены и секреты API не возвращаются. При блокировке пользователя refresh-сессии отзываются; проверка активности при каждом защищённом запросе делает недействительными и действующие Access Tokens.

## Поиск, фильтры и журнал

Для списков игр, категорий и игроков поддерживаются `page`, `limit` (1–100), `sortBy`, `order=asc|desc` и `search` (1–100 символов). Игры фильтруются по категории, провайдеру, волатильности и активности; SQL строится Sequelize-операторами. Сортировка использует белый список и добавляет `id` для стабильного порядка. Максимальное смещение — 1 000 000 записей. В `search` символы `%` и `_` трактуются как обычные символы.

`GET /api/admin/audit-logs?page=1&limit=20&userId=1&action=UPDATE_GAME&entityType=Product&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z` доступен только `ADMIN`. Успешные изменения игр, категорий, профилей игроков, регистрация, вход, обновление токена, назначение ролей и блокировка пишутся в `audit_logs`; критические изменения и запись аудита выполняются в одной транзакции. Audit log API допускает только чтение.

## HTTP-защита и OpenAPI

`Helmet` задаёт security headers, `express.json` ограничен 100 KB, общий лимит — 300 запросов с IP за 15 минут, ошибки входа ограничиваются по IP и нормализованному email (успешные входы лимиты не расходуют), регистрация — 10 за 15 минут. За reverse proxy явно задайте `TRUST_PROXY` (число доверенных переходов или список доверенных адресов); по умолчанию прокси не доверяется. CORS разрешает источники из `CORS_ORIGIN` (список через запятую); пустое значение отключает кросс-доменные браузерные запросы. `ENABLE_DOCS` управляет Swagger/OpenAPI: по умолчанию включено вне production и выключено в production. Refresh reuse отзывает всё семейство и фиксируется в аудите; `/api/auth/logout-all` отзывает все refresh-сессии пользователя. Изменение email через Player PATCH запрещено не-ADMIN; администратор может синхронизировать логин через управляемую операцию. Защищённые операции отмечены Bearer-аутентификацией.
