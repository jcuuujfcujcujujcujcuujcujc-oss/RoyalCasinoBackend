'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const env = require('../config/env');

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run db:restore -- <backup.dump>');
  process.exit(2);
}
if (process.env.DB_RESTORE_CONFIRM !== 'YES') {
  console.error('Restore overwrites objects in the target database. Set DB_RESTORE_CONFIRM=YES to continue.');
  process.exit(2);
}

const child = spawn(
  'pg_restore',
  [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--host',
    env.db.host,
    '--port',
    String(env.db.port),
    '--username',
    env.db.user,
    '--dbname',
    env.db.name,
    path.resolve(input),
  ],
  { stdio: 'inherit', env: { ...process.env, PGPASSWORD: env.db.password } }
);
child.on('error', (error) => {
  console.error(`pg_restore не запущен: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  if (code !== 0) process.exitCode = code || 1;
});
