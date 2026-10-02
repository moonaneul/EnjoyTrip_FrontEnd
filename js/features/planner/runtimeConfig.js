let cached;

async function loadFileConfig() {
  if (globalThis.TEUM_KEYS) return globalThis.TEUM_KEYS;
  try {
    const module = await import('../../config/keys.local.js');
    return module.TEUM_KEYS || {};
  } catch {
    const module = await import('../../config/keys.example.js');
    return module.TEUM_KEYS || {};
  }
}

async function loadServerConfig() {
  if (!globalThis.location || !/^https?:$/.test(globalThis.location.protocol)) return {};
  try {
    const response = await fetch('/api/runtime-config', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return {};
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return {};
    return await response.json();
  } catch {
    return {};
  }
}

export async function getRuntimeKeys() {
  if (cached) return cached;
  const [fileConfig, serverConfig] = await Promise.all([loadFileConfig(), loadServerConfig()]);
  cached = { ...fileConfig, ...serverConfig };
  return cached;
}
