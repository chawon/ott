import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createDevApiHandler } from './dev-api-proxy.mjs';
import { createPreviewServer } from './serve.mjs';

const identities = {
  ABCD2345: { userId: '11111111-1111-4111-8111-111111111111', deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  ZXCV2345: { userId: '22222222-2222-4222-8222-222222222222', deviceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
};

async function listen(t, server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t, options = {}) {
  const requests = [];
  const behavior = { status: 200, redirect: false };
  const backend = await listen(t, createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    requests.push({ method: req.method, path: req.url, headers: req.headers, body: body && JSON.parse(body) });
    res.setHeader('Content-Type', 'application/json');
    if (behavior.redirect) { res.writeHead(302, { Location: '/should-not-follow' }).end(); return; }
    if (behavior.status !== 200) { res.writeHead(behavior.status).end(JSON.stringify({ message: 'SECRET upstream error' })); return; }
    if (req.url === '/api/auth/pair') {
      const identity = identities[JSON.parse(body).code];
      res.writeHead(identity ? 200 : 400).end(JSON.stringify(identity ? { ...identity, pairingCode: JSON.parse(body).code } : { message: 'Invalid code' }));
      return;
    }
    if (req.url.startsWith('/api/logs/page')) {
      res.end(JSON.stringify({ items: [{ id: req.headers['x-user-id'], note: 'A real-shaped record' }], nextCursor: 'next/cursor+=' }));
      return;
    }
    if (req.url === '/api/auth/profile') { res.end(JSON.stringify({ nickname: 'Preview reader' })); return; }
    res.writeHead(404).end('{}');
  }));
  const handler = createDevApiHandler({ apiUrl: backend, ...options });
  const base = await listen(t, createServer(async (req, res) => {
    if (!await handler(req, res)) res.writeHead(404).end();
  }));
  const request = (path, init = {}) => fetch(`${base}/preview-api${path}`, init);
  async function pair(code = 'ABCD2345', extra = {}) {
    const response = await request('/session', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', ...extra.headers }, body: JSON.stringify({ code }), ...extra });
    return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  return { request, pair, requests, behavior, base };
}

test('configuration endpoint is safe when no backend is configured', async t => {
  const base = await listen(t, createPreviewServer({ apiUrl: '' }));
  const response = await fetch(`${base}/preview-api/session`);
  assert.deepEqual(await response.json(), { configured: false, connected: false });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const pair = await fetch(`${base}/preview-api/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{"code":"ABCD2345"}' });
  assert.equal(pair.status, 503);
  assert.deepEqual(await pair.json(), { error: 'NOT_CONFIGURED' });
});

test('pairing sends only the normalized code; opaque cookie hides all credentials', async t => {
  const f = await fixture(t);
  const { response, cookie } = await f.pair('abcd 2345');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { configured: true, connected: true });
  assert.match(cookie, /^ottline_preview_session=[a-f\d]{64}$/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.match(response.headers.get('set-cookie'), /Path=\/preview-api/);
  assert.equal(response.headers.get('set-cookie').includes('ABCD2345'), false);
  assert.deepEqual(f.requests[0].body, { code: 'ABCD2345' });
  assert.equal(f.requests[0].headers['x-user-id'], undefined);
  const state = await f.request('/session', { headers: { Cookie: cookie } });
  assert.deepEqual(await state.json(), { configured: true, connected: true });
});

test('HTTPS tunnel pairing gets a Secure cookie', async t => {
  const f = await fixture(t);
  const response = await f.request('/session', { method: 'POST', headers: { Origin: f.base.replace('http:', 'https:'), 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' }, body: '{"code":"ABCD2345"}' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /; Secure$/);
});

test('reads use the session credentials and preserve cursor and locale', async t => {
  const f = await fixture(t);
  const { cookie } = await f.pair();
  const cursor = 'opaque/+cursor==';
  const response = await f.request(`/logs/page?limit=50&cursor=${encodeURIComponent(cursor)}`, { headers: { Cookie: cookie, 'X-User-Id': identities.ZXCV2345.userId, 'X-Device-Id': identities.ZXCV2345.deviceId, 'Accept-Language': 'en-US,en;q=0.9' } });
  assert.equal(response.status, 200);
  const page = await response.json();
  assert.equal(page.items[0].id, identities.ABCD2345.userId);
  assert.equal(page.nextCursor, 'next/cursor+=');
  const forwarded = f.requests.at(-1);
  assert.equal(forwarded.method, 'GET');
  assert.equal(new URL(forwarded.path, f.base).searchParams.get('cursor'), cursor);
  assert.equal(forwarded.headers['x-device-id'], identities.ABCD2345.deviceId);
  assert.equal(forwarded.headers['accept-language'], 'en');
  const profile = await f.request('/auth/profile', { headers: { Cookie: cookie } });
  assert.deepEqual(await profile.json(), { nickname: 'Preview reader' });
});

test('separate browser sessions cannot read each other or a global account', async t => {
  const f = await fixture(t);
  const a = await f.pair();
  const b = await f.pair('ZXCV2345');
  assert.notEqual(a.cookie, b.cookie);
  for (const [cookie, id] of [[a.cookie, identities.ABCD2345.userId], [b.cookie, identities.ZXCV2345.userId]]) {
    const response = await f.request('/logs/page', { headers: { Cookie: cookie } });
    assert.equal((await response.json()).items[0].id, id);
  }
  assert.equal((await f.request('/logs/page')).status, 401);
  const fake = await f.request('/logs/page', { headers: { Cookie: 'ottline_preview_session=guessed' } });
  assert.equal(fake.status, 401);
});

test('the bridge rejects arbitrary endpoints, writes, extra parameters and account merge input', async t => {
  const f = await fixture(t);
  const { cookie } = await f.pair();
  const count = f.requests.length;
  for (const [path, method, status] of [
    ['/logs', 'POST', 404], ['/auth/register', 'POST', 404], ['/auth/account', 'DELETE', 404],
    ['/logs/page', 'PATCH', 405], ['/auth/profile', 'PATCH', 405], ['/session', 'PUT', 405],
    ['/logs/page?url=http://evil.example', 'GET', 400], ['/logs/page?limit=50&limit=100', 'GET', 400],
    ['/logs/page?limit=9999', 'GET', 400], ['/logs/page?cursor=', 'GET', 400], ['/auth/profile?userId=other', 'GET', 400],
  ]) {
    const response = await f.request(path, { method, headers: { Cookie: cookie, Origin: f.base } });
    assert.equal(response.status, status, `${method} ${path}`);
  }
  const merge = await f.request('/session', { method: 'POST', headers: { Cookie: cookie, Origin: f.base, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'ABCD2345', oldUserId: identities.ZXCV2345.userId }) });
  assert.equal(merge.status, 400);
  assert.equal(f.requests.length, count);
});

test('pairing and disconnect reject cross-site, absent origin and form submissions', async t => {
  const f = await fixture(t);
  for (const headers of [
    { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    { 'Content-Type': 'application/json' },
    { Origin: f.base, 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' },
  ]) {
    const response = await f.request('/session', { method: 'POST', headers, body: '{"code":"ABCD2345"}' });
    assert.equal(response.status, 403);
  }
  const form = await f.request('/session', { method: 'POST', headers: { Origin: f.base, 'Content-Type': 'text/plain' }, body: '{"code":"ABCD2345"}' });
  assert.equal(form.status, 400);
  const disconnect = await f.request('/session', { method: 'DELETE', headers: { Origin: 'https://evil.example' } });
  assert.equal(disconnect.status, 403);
  assert.equal(f.requests.length, 0);
});

test('invalid codes and oversized bodies never reach the backend', async t => {
  const f = await fixture(t);
  for (const code of ['A', 'IIII2345', 'ABCD0000', '<script>', 'A'.repeat(2000)]) {
    const { response } = await f.pair(code);
    assert.equal(response.status, 400);
  }
  assert.equal(f.requests.length, 0);
  const invalid = await f.pair('ZZZZ9999');
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(await invalid.response.json(), { error: 'INVALID_CODE' });
});

test('disconnect only drops this preview session, without backend unlink or deletion', async t => {
  const f = await fixture(t);
  const { cookie } = await f.pair();
  const count = f.requests.length;
  const response = await f.request('/session', { method: 'DELETE', headers: { Cookie: cookie, Origin: f.base } });
  assert.deepEqual(await response.json(), { configured: true, connected: false });
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await f.request('/logs/page', { headers: { Cookie: cookie } })).status, 401);
  assert.equal(f.requests.length, count);
});

test('revoked and expired credentials invalidate the local session', async t => {
  let time = 0;
  const f = await fixture(t, { now: () => time });
  for (const status of [401, 403]) {
    f.behavior.status = 200;
    const { cookie } = await f.pair();
    f.behavior.status = status;
    const response = await f.request('/logs/page', { headers: { Cookie: cookie } });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'SESSION_EXPIRED' });
    const state = await f.request('/session', { headers: { Cookie: cookie } });
    assert.equal((await state.json()).connected, false);
  }
  f.behavior.status = 200;
  const { cookie } = await f.pair();
  time = 8 * 60 * 60 * 1000 + 1;
  assert.equal((await f.request('/logs/page', { headers: { Cookie: cookie } })).status, 401);
});

test('backend failures are sanitized and redirects never receive credentials', async t => {
  const f = await fixture(t);
  const { cookie } = await f.pair();
  f.behavior.status = 500;
  const failure = await f.request('/logs/page', { headers: { Cookie: cookie } });
  assert.equal(failure.status, 502);
  assert.deepEqual(await failure.json(), { error: 'API_UNAVAILABLE' });
  const pair = await f.pair();
  assert.equal(pair.response.status, 502);
  assert.deepEqual(await pair.response.json(), { error: 'CONNECTION_FAILED' });
  f.behavior.redirect = true;
  const redirect = await f.request('/logs/page', { headers: { Cookie: cookie } });
  assert.equal(redirect.status, 502);
  assert.equal(f.requests.some(req => req.path === '/should-not-follow'), false);
});

test('network failures return a retryable error', async t => {
  const f = await fixture(t, { fetchImpl: async () => { throw new Error('SECRET network error'); } });
  const pair = await f.pair();
  assert.equal(pair.response.status, 502);
  assert.deepEqual(await pair.response.json(), { error: 'CONNECTION_FAILED' });
});

test('a stalled backend request is aborted at the configured timeout', async t => {
  let aborted = false;
  const f = await fixture(t, {
    timeoutMs: 20,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    }),
  });
  const pair = await f.pair();
  assert.equal(aborted, true);
  assert.equal(pair.response.status, 502);
  assert.deepEqual(await pair.response.json(), { error: 'CONNECTION_FAILED' });
});

test('static preview still serves assets but not repository files or server modules', async t => {
  const base = await listen(t, createPreviewServer({ apiUrl: '' }));
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/styles.css`)).status, 200);
  for (const path of ['/dev-api-proxy.mjs', '/serve.mjs', '/.env', '/../../DESIGN.md', '/api/logs']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404);
  }
});

test('backend configuration rejects credentials, URLs with paths, and non-HTTP protocols', () => {
  for (const apiUrl of ['file:///etc/passwd', 'http://user:pass@localhost:8080', 'http://localhost:8080/api', 'http://localhost:8080/?token=secret']) {
    assert.throws(() => createDevApiHandler({ apiUrl }));
  }
});
