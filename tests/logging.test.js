'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('structured logger redacts credentials, tokens, and authorization headers', () => {
  const output = spawnSync(
    process.execPath,
    [
      '-e',
      `const {logger}=require('./src/utils/logger');logger.info({req:{headers:{authorization:'Bearer auth-secret',cookie:'cookie-secret', 'x-api-key':'api-secret'},body:{password:'password-secret',refreshToken:'refresh-secret'}},res:{headers:{'set-cookie':'session-secret'}}},'redaction probe')`,
    ],
    { cwd: path.resolve(__dirname, '..'), env: process.env, encoding: 'utf8' }
  );
  assert.equal(output.status, 0, output.stderr);
  for (const secret of [
    'auth-secret',
    'cookie-secret',
    'api-secret',
    'password-secret',
    'refresh-secret',
    'session-secret',
  ])
    assert.equal(output.stdout.includes(secret), false, `${secret} leaked into log`);
  assert.match(output.stdout, /\[REDACTED\]/);
});
