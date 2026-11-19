# Contributing

## Local setup

1. Use Node.js 22 and PostgreSQL 16.
2. Copy `.env.example` to `.env` and set local database credentials plus a random `JWT_SECRET` of at least 32 bytes.
3. Run `npm ci`, `npm run db:migrate`, `npm run lint`, `npm run format:check`, and `npm test`.
4. Integration tests only run against a database whose `DB_NAME` ends with `_test`; they truncate test data.

## Changes

- Keep the Express 5, CommonJS, Sequelize 6, PostgreSQL, and `node:test` stack.
- Keep virtual credits non-monetary. Do not add deposits, withdrawals, payment providers, or real-money flows.
- Add a new migration instead of editing one that may have been applied.
- Add or update tests and OpenAPI/API documentation when behavior changes.
- Use Conventional Commit messages, for example `fix: reject refresh token replay`.
- Never commit `.env`, credentials, tokens, backup files, or personal data.
