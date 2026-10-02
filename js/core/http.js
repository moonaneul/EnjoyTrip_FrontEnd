const DEFAULT_TIMEOUT_MS = 8000;
const SENSITIVE_QUERY_KEYS = new Set(['serviceKey', 'apiKey', 'apikey', 'key', 'token', 'accessToken']);

function redactUrl(url) {
  try {
    const target = new URL(url, globalThis.location?.href || 'http://localhost/');
    for (const key of [...target.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key)) target.searchParams.set(key, '[REDACTED]');
    }
    return target.toString();
  } catch {
    return String(url);
  }
}

export class HttpError extends Error {
  constructor(message, { status = null, url = null, cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

export class TimeoutError extends Error {
  constructor(message, { url = null, timeoutMs = null, cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'TimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export class NetworkError extends Error {
  constructor(message, { url = null, cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'NetworkError';
    this.url = url;
  }
}

export class JsonParseError extends Error {
  constructor(message, { url = null, bodySnippet = '', cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'JsonParseError';
    this.url = url;
    this.bodySnippet = bodySnippet;
  }
}

function appendQuery(url, params = {}) {
  const target = new URL(url, globalThis.location?.href || 'http://localhost/');
  const search = new URLSearchParams(target.search);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });

  target.search = search.toString();
  return target.toString();
}

/**
 * GET 요청 후 JSON을 반환한다.
 * - response.ok 검증
 * - AbortController 기반 timeout
 * - network / timeout / HTTP / JSON parse 오류를 구분
 * - debug=true 시 URL과 결과를 console.debug로 남김
 */
export async function getJson(url, params = {}, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    debug = false,
    headers = {},
    signal: externalSignal,
  } = options;

  const requestUrl = appendQuery(url, params);
  const controller = new AbortController();
  let didTimeout = false;

  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }

  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);

  try {
    if (debug) console.debug('[HTTP GET]', redactUrl(requestUrl));

    let response;
    try {
      response = await fetch(requestUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (didTimeout) {
        throw new TimeoutError(`요청 시간이 ${timeoutMs}ms를 초과했습니다.`, {
          url: redactUrl(requestUrl),
          timeoutMs,
          cause: error,
        });
      }

      if (controller.signal.aborted) throw error;

      throw new NetworkError('네트워크 요청에 실패했습니다.', {
        url: redactUrl(requestUrl),
        cause: error,
      });
    }

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} 응답을 받았습니다.`, {
        status: response.status,
        url: redactUrl(requestUrl),
      });
    }

    const text = await response.text();
    if (!text.trim()) return null;

    try {
      const json = JSON.parse(text);
      if (debug) console.debug('[HTTP JSON]', json);
      return json;
    } catch (error) {
      throw new JsonParseError('JSON 응답을 해석하지 못했습니다.', {
        url: redactUrl(requestUrl),
        bodySnippet: text.slice(0, 1000),
        cause: error,
      });
    }
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromExternal);
  }
}

export const http = Object.freeze({ getJson });
