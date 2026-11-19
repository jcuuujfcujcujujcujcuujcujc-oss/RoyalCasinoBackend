'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function docsStatus(enableDocs) {
  const env = { ...process.env };
  for (const key of ['ENABLE_DOCS', 'TRUST_PROXY']) delete env[key];
  Object.assign(env, {
    NODE_ENV: 'production',
    DB_HOST: '127.0.0.1',
    DB_NAME: 'royal_casino_security_test',
    DB_USER: 'test-user',
    DB_PASSWORD: 'safe-test-password',
    JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
    LOG_LEVEL: 'silent',
  });
  if (enableDocs !== undefined) env.ENABLE_DOCS = enableDocs;
  const script = `const app=require('./src/app');const s=app.listen(0,async()=>{const base='http://127.0.0.1:'+s.address().port;const a=await fetch(base+'/api/docs');const b=await fetch(base+'/api/openapi.json');console.log(a.status+','+b.status);s.close()})`;
  return spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
}

test('Swagger and OpenAPI are disabled by default in production and can be explicitly enabled', () => {
  const disabled = docsStatus(undefined);
  assert.equal(disabled.status, 0, disabled.stderr);
  assert.match(disabled.stdout, /404,404/);
  const enabled = docsStatus('true');
  assert.equal(enabled.status, 0, enabled.stderr);
  assert.match(enabled.stdout, /200,200/);
});
