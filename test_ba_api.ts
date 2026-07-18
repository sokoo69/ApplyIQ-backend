import { betterAuth } from 'better-auth';
import { toNodeHandler } from 'better-auth/node';

const auth = betterAuth({
  database: { type: 'sqlite', url: ':memory:' },
  baseURL: 'http://localhost:8000/api/v1/auth',
  emailAndPassword: { enabled: true }
});

const handler = toNodeHandler(auth);

import http from 'http';

const server = http.createServer((req, res) => {
  return toNodeHandler(auth)(req, res);
});

server.listen(3030, () => {
  fetch('http://localhost:3030/api/v1/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com', password: 'password', name: 'Test' }),
    headers: { 'Content-Type': 'application/json' }
  }).then(async (res) => {
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
    server.close();
  });
});
