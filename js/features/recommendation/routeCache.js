function coord(value) { return Number(value).toFixed(5); }

export function routeCacheKey(mode, origin, destination) {
  return `${mode}:${coord(origin.lat)},${coord(origin.lng)}:${coord(destination.lat)},${coord(destination.lng)}`;
}

export class CachedRouteProvider {
  constructor(provider) {
    this.provider = provider;
    this.cache = new Map();
    this.stats = { requests: 0, hits: 0 };
  }

  async getRoute(params) {
    const key = routeCacheKey(params.mode, params.origin, params.destination);
    if (this.cache.has(key)) {
      this.stats.hits += 1;
      return this.cache.get(key);
    }
    this.stats.requests += 1;
    const promise = Promise.resolve(this.provider.getRoute(params));
    this.cache.set(key, promise);
    return promise;
  }

  clear() {
    this.cache.clear();
    this.stats = { requests: 0, hits: 0 };
  }
}
