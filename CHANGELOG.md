# Changelog

## Unreleased

- Added opt-in production Swagger/OpenAPI publishing, request IDs, structured redacted logging, readiness checks, Docker deployment, CI/security scanning, and Dependabot.
- Added refresh-token family replay detection and `POST /api/auth/logout-all`.
- Added an immutable ledger for virtual credit adjustments, history, and idempotency. Credit profile `balance` is now returned as a decimal string to preserve NUMERIC precision.
- Added `POST /api/players/:id/credits/adjustments` (ADMIN only) and `GET /api/players/:id/credits/transactions` (owner/MANAGER/ADMIN).
- Non-ADMIN Player PATCH can no longer change the linked login email. MANAGER can read any player and virtual credit history.
