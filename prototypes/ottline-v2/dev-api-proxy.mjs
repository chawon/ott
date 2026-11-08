import { randomBytes } from 'node:crypto';

const PREFIX = '/preview-api';
const COOKIE = 'ottline_preview_session';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const MAX_SESSIONS = 200;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function reply(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}

function cookieValue(req) {
  return (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
}

function setCookie(req, res, value, maxAge) {
  const secure = req.socket.encrypted || req.headers['x-forwarded-proto']?.split(',')[0].trim() === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=${PREFIX}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}

function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return false;
  try {
    const origin = new URL(req.headers.origin);
    const scheme = req.socket.encrypted || req.headers['x-forwarded-proto']?.split(',')[0].trim() === 'https' ? 'https:' : 'http:';
    return origin.host === req.headers.host && origin.protocol === scheme;
  } catch { return false; }
}

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new Error('INVALID_REQUEST');
  if (Number(req.headers['content-length']) > 1024) throw new Error('INVALID_REQUEST');
  let body = '';
  for await (const part of req) {
    body += part;
    if (Buffer.byteLength(body) > 1024) throw new Error('INVALID_REQUEST');
  }
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new Error('INVALID_REQUEST'); }
}

function backendOrigin(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PREVIEW_API_URL must be an HTTP(S) origin without credentials, a path, or query parameters.');
  }
  return url.origin;
}

// Credentials stay in this process and are scoped to an opaque browser cookie.
// The sole upstream write is pairing an explicitly supplied code, without merging accounts.
export function createDevApiHandler({ apiUrl, fetchImpl = fetch, timeoutMs = 10_000, now = Date.now } = {}) {
  const origin = backendOrigin(apiUrl);
  const sessions = new Map();

  function prune() {
    for (const [id, session] of sessions) if (session.expires <= now()) sessions.delete(id);
  }

  async function upstream(path, options = {}) {
    return fetchImpl(`${origin}${path}`, {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  return async function handleDevApi(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return false;
    const fail = (status, error) => { reply(res, status, { error }); return true; };
    prune();
    const cookie = cookieValue(req);
    const session = sessions.get(cookie);
    const sessionRoute = url.pathname === `${PREFIX}/session`;
    const logsRoute = url.pathname === `${PREFIX}/logs/page`;
    const profileRoute = url.pathname === `${PREFIX}/auth/profile`;
    if (!sessionRoute && !logsRoute && !profileRoute) return fail(404, 'NOT_FOUND');
    if (sessionRoute && req.method === 'GET') {
      if (url.search) return fail(400, 'INVALID_REQUEST');
      reply(res, 200, { configured: Boolean(origin), connected: Boolean(session) });
      return true;
    }
    if (sessionRoute && ['POST', 'DELETE'].includes(req.method)) {
      if (!sameOrigin(req)) return fail(403, 'FORBIDDEN');
      if (url.search) return fail(400, 'INVALID_REQUEST');
      if (req.method === 'DELETE') {
        sessions.delete(cookie);
        setCookie(req, res, '', 0);
        reply(res, 200, { configured: Boolean(origin), connected: false });
        return true;
      }
      if (!origin) return fail(503, 'NOT_CONFIGURED');
      let body;
      try { body = await readJson(req); } catch { return fail(400, 'INVALID_REQUEST'); }
      if (typeof body.code !== 'string' || Object.keys(body).some(key => key !== 'code')) return fail(400, 'INVALID_REQUEST');
      const code = body.code.replace(/\s/g, '').toUpperCase();
      if (!CODE.test(code)) return fail(400, 'INVALID_CODE');
      try {
        const response = await upstream('/api/auth/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'OTTLINE Design Preview', 'X-Client-Platform': 'web' },
          body: JSON.stringify({ code }),
        });
        if ([400, 401, 403, 404].includes(response.status)) return fail(400, 'INVALID_CODE');
        if (!response.ok) return fail(502, 'CONNECTION_FAILED');
        const auth = await response.json();
        if (!UUID.test(auth?.userId) || !UUID.test(auth?.deviceId)) return fail(502, 'CONNECTION_FAILED');
        sessions.delete(cookie);
        if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
        const token = randomBytes(32).toString('hex');
        sessions.set(token, { userId: auth.userId, deviceId: auth.deviceId, expires: now() + SESSION_TTL });
        setCookie(req, res, token, SESSION_TTL / 1000);
        reply(res, 200, { configured: true, connected: true });
        return true;
      } catch { return fail(502, 'CONNECTION_FAILED'); }
    }
    if (req.method !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED');
    if (!origin) return fail(503, 'NOT_CONFIGURED');
    if (!session) return fail(401, cookie ? 'SESSION_EXPIRED' : 'SESSION_REQUIRED');

    let path = '/api/auth/profile';
    if (profileRoute && url.search) return fail(400, 'INVALID_REQUEST');
    if (logsRoute) {
      const keys = [...url.searchParams.keys()];
      if (keys.some(key => !['limit', 'cursor'].includes(key)) || new Set(keys).size !== keys.length) return fail(400, 'INVALID_REQUEST');
      const rawLimit = url.searchParams.get('limit') ?? '50';
      const cursor = url.searchParams.get('cursor');
      if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 100 || (cursor !== null && (!cursor || cursor.length > 4096))) return fail(400, 'INVALID_REQUEST');
      const query = new URLSearchParams({ limit: String(Number(rawLimit)) });
      if (cursor) query.set('cursor', cursor);
      path = `/api/logs/page?${query}`;
    }
    try {
      const response = await upstream(path, {
        headers: {
          'X-User-Id': session.userId,
          'X-Device-Id': session.deviceId,
          'Accept-Language': req.headers['accept-language']?.toLowerCase().startsWith('en') ? 'en' : 'ko',
        },
      });
      if ([401, 403].includes(response.status)) {
        sessions.delete(cookie);
        setCookie(req, res, '', 0);
        return fail(401, 'SESSION_EXPIRED');
      }
      if (!response.ok) return fail(response.status === 400 ? 400 : 502, response.status === 400 ? 'INVALID_REQUEST' : 'API_UNAVAILABLE');
      const data = await response.json();
      reply(res, 200, data);
      return true;
    } catch { return fail(502, 'API_UNAVAILABLE'); }
  };
}
