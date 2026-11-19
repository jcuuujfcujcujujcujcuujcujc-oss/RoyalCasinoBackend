'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { loginAccount } = require('../src/middleware/rateLimits');

test('login account limiter counts failures, skips successes, and keys by normalized email', async (t) => {
  const app = express();
  app.use(express.json());
  app.post('/login', loginAccount, (req, res) => res.sendStatus(req.body.success ? 200 : 401));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/login`;
  const email = `limit-${crypto.randomUUID()}@example.test`;
  const send = (address, success = false) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address, success }),
    });

  for (let i = 0; i < 4; i += 1) assert.equal((await send(email)).status, 401);
  for (let i = 0; i < 3; i += 1) assert.equal((await send(email.toUpperCase(), true)).status, 200);
  assert.equal((await send(email)).status, 401);
  const blocked = await send(email);
  assert.equal(blocked.status, 429);
  assert.equal((await send(`different-${email}`)).status, 401);
});
