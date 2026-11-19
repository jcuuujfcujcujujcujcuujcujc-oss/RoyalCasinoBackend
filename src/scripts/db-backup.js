'use strict';

const { spawn } = require('node:child_process');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

const output = path.resolve(
  process.argv[2] ||
    path.join('.backups', `royal-casino-${new Date().toISOString().replaceAll(':', '-')}.dump`)
);
const env = require('../config/env');

async function main() {
  await mkdir(path.dirname(output), { recursive: true });
  const child = spawn(
    'pg_dump',
    [
      '--format=custom',
      '--no-owner',
      '--host',
      env.db.host,
      '--port',
      String(env.db.port),
      '--username',
      env.db.user,
      '--dbname',
      env.db.name,
      '--file',
      output,
    ],
    { stdio: 'inherit', env: { ...process.env, PGPASSWORD: env.db.password } }
  );
  child.on('error', (error) => {
    console.error(`pg_dump не запущен: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    if (code !== 0) process.exitCode = code || 1;
    else console.log(`Backup created: ${output}`);
  });
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exitCode = 1;
});
