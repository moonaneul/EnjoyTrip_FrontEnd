import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT || 4173);

function parseEnv(text = '') {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

async function loadLocalEnv() {
  try {
    return parseEnv(await readFile(join(ROOT, '.env.local'), 'utf8'));
  } catch {
    return {};
  }
}

const localEnv = await loadLocalEnv();
const REST_API_KEY = process.env.KAKAO_REST_API_KEY || localEnv.KAKAO_REST_API_KEY || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

async function proxyJson(res, targetUrl) {
  if (!REST_API_KEY) {
    json(res, 503, { error: 'KAKAO_REST_API_KEY_MISSING' });
    return;
  }
  try {
    const response = await fetch(targetUrl, {
      headers: {
        Authorization: `KakaoAK ${REST_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const body = await response.text();
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (error) {
    json(res, 502, { error: 'KAKAO_PROXY_FAILED', message: error?.message || 'proxy failed' });
  }
}

function safeStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const candidate = normalize(decoded).replace(/^([/\\])+/, '');
  const full = resolve(ROOT, candidate);
  return full.startsWith(ROOT) ? full : null;
}

async function serveStatic(req, res, pathname) {
  const filePath = safeStaticPath(pathname);
  if (!filePath) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not file');
    const content = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);

  if (url.pathname === '/api/runtime-config') {
    json(res, 200, {
      kakaoApiProxyBaseUrl: '/api/kakao',
      hasKakaoRestApiKey: Boolean(REST_API_KEY),
    });
    return;
  }

  if (url.pathname === '/api/kakao/geocode') {
    const query = url.searchParams.get('query') || '';
    if (!query.trim()) { json(res, 400, { error: 'QUERY_REQUIRED' }); return; }
    const target = new URL('https://dapi.kakao.com/v2/local/search/address.json');
    target.searchParams.set('query', query.trim());
    await proxyJson(res, target);
    return;
  }

  if (url.pathname === '/api/kakao/keyword') {
    const query = url.searchParams.get('query') || '';
    if (!query.trim()) { json(res, 400, { error: 'QUERY_REQUIRED' }); return; }
    const target = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    target.searchParams.set('query', query.trim());
    const x = url.searchParams.get('x');
    const y = url.searchParams.get('y');
    const radius = url.searchParams.get('radius');
    if (x) target.searchParams.set('x', x);
    if (y) target.searchParams.set('y', y);
    if (radius) target.searchParams.set('radius', radius);
    await proxyJson(res, target);
    return;
  }

  if (url.pathname === '/api/kakao/reverse-geocode') {
    const x = url.searchParams.get('x') || '';
    const y = url.searchParams.get('y') || '';
    if (!x || !y) { json(res, 400, { error: 'COORDINATES_REQUIRED' }); return; }
    const target = new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json');
    target.searchParams.set('x', x);
    target.searchParams.set('y', y);
    target.searchParams.set('input_coord', url.searchParams.get('input_coord') || 'WGS84');
    await proxyJson(res, target);
    return;
  }

  if (url.pathname === '/api/kakao/transit') {
    const target = new URL('https://dapi.kakao.com/v2/routing/publictraffic');
    for (const name of ['start_x', 'start_y', 'end_x', 'end_y', 'input_coord']) {
      const value = url.searchParams.get(name);
      if (value) target.searchParams.set(name, value);
    }
    await proxyJson(res, target);
    return;
  }

  if (url.pathname === '/api/kakao/walk') {
    const target = new URL('https://dapi.kakao.com/v2/routing/walk');
    for (const name of ['start_x', 'start_y', 'end_x', 'end_y', 'input_coord']) {
      const value = url.searchParams.get(name);
      if (value) target.searchParams.set(name, value);
    }
    await proxyJson(res, target);
    return;
  }

  if (url.pathname === '/api/kakao/car') {
    const target = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    for (const name of ['origin', 'destination', 'priority', 'summary']) {
      const value = url.searchParams.get(name);
      if (value) target.searchParams.set(name, value);
    }
    await proxyJson(res, target);
    return;
  }

  await serveStatic(req, res, url.pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TEUM DEV2 server: http://localhost:${PORT}/index.html`);
  console.log(`Kakao REST proxy: ${REST_API_KEY ? 'READY' : 'NO KEY (estimated route fallback)'}`);
});
