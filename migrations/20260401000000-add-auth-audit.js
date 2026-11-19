'use strict';
module.exports = {
  async up(q) {
    await q.sequelize.transaction(async (transaction) => {
      const run = (sql) => q.sequelize.query(sql, { transaction });
      await run(`CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(254) NOT NULL, password_hash VARCHAR(100) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT users_email_lower CHECK (email = lower(email)), CONSTRAINT users_email_key UNIQUE(email))`);
      await run(`CREATE TABLE roles (id SERIAL PRIMARY KEY, code VARCHAR(32) NOT NULL UNIQUE CHECK (code = upper(code) AND code ~ '^[A-Z][A-Z0-9_]{1,31}$'), name VARCHAR(100) NOT NULL)`);
      await run(`INSERT INTO roles(code,name) VALUES ('ADMIN','Администратор'),('MANAGER','Менеджер'),('PLAYER','Игрок')`);
      await run(`CREATE TABLE user_roles (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT, PRIMARY KEY(user_id,role_id))`);
      await run(`CREATE TABLE refresh_tokens (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash CHAR(64) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await run(`CREATE INDEX refresh_tokens_user_active_idx ON refresh_tokens(user_id, expires_at) WHERE revoked_at IS NULL`);
      await run(`CREATE TABLE audit_logs (id BIGSERIAL PRIMARY KEY, user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(80) NOT NULL, entity_type VARCHAR(80) NOT NULL, entity_id VARCHAR(80) NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await run(`CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at DESC)`);
      await run(`ALTER TABLE players ADD COLUMN user_id INTEGER NULL UNIQUE REFERENCES users(id) ON DELETE SET NULL`);
    });
  },
  async down(q) {
    await q.sequelize.transaction(async (transaction) => {
      for (const sql of ['ALTER TABLE players DROP COLUMN user_id','DROP TABLE audit_logs','DROP TABLE refresh_tokens','DROP TABLE user_roles','DROP TABLE roles','DROP TABLE users']) await q.sequelize.query(sql, { transaction });
    });
  },
};
