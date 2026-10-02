import { haversineMeters, hasValidCoordinates } from '../features/recommendation/distance.js';

const TRANSIT_URL = 'https://dapi.kakao.com/v2/routing/publictraffic';
const WALK_URL = 'https://dapi.kakao.com/v2/routing/walk';
const CAR_URL = 'https://apis-navi.kakaomobility.com/v1/directions';
const DEFAULT_WALK_FALLBACK_MAX_M = 1500;

function unavailable(mode, raw = null, failureReason = null) {
  return { mode, durationMin: 0, distanceM: null, fare: null, transfers: null, legs: [], providerStatus: 'unavailable', failureReason, raw };
}

function bestTransitRoute(payload) {
  const routes = Array.isArray(payload?.routes) ? payload.routes : [];
  return routes.slice().sort((a, b) => (a?.properties?.totalTime ?? Infinity) - (b?.properties?.totalTime ?? Infinity))[0] || null;
}

function proxyUrl(base, path) {
  if (!base) return null;
  const root = base.replace(/\/$/, '');
  return new URL(`${root}/${path}`, globalThis.location?.origin || 'http://localhost');
}

async function responsePayload(response) {
  try { return await response.json(); }
  catch {
    try { return { message: await response.text() }; }
    catch { return null; }
  }
}

function failureFromPayload(payload, httpStatus = null) {
  if (typeof payload?.status === 'string' && payload.status !== 'OK') return payload.status;
  if (payload?.errorType) return payload.errorType;
  if (payload?.error) return payload.error;
  if (httpStatus) return `HTTP_${httpStatus}`;
  return 'PRIMARY_ROUTE_UNAVAILABLE';
}

export class KakaoRouteProvider {
  constructor({ restApiKey, apiProxyBaseUrl = '', fetchImpl = globalThis.fetch } = {}) {
    this.restApiKey = restApiKey || '';
    this.apiProxyBaseUrl = apiProxyBaseUrl || '';
    this.fetchImpl = fetchImpl;
    this.walkEndpointUnavailable = false;
  }

  async getRoute({ origin, destination, mode }) {
    if ((!this.restApiKey && !this.apiProxyBaseUrl) || !this.fetchImpl || !hasValidCoordinates(origin) || !hasValidCoordinates(destination)) {
      return unavailable(mode, null, 'ROUTE_PROVIDER_NOT_READY');
    }
    try {
      if (mode === 'transit') return await this.#transit(origin, destination);
      if (mode === 'walk') return await this.#walk(origin, destination);
      if (mode === 'car') return await this.#car(origin, destination);
      return unavailable(mode, null, 'UNSUPPORTED_MODE');
    } catch (error) {
      return unavailable(mode, { message: error?.message || 'route_error' }, 'ROUTE_EXCEPTION');
    }
  }

  async #transit(origin, destination) {
    const url = this.apiProxyBaseUrl ? proxyUrl(this.apiProxyBaseUrl, 'transit') : new URL(TRANSIT_URL);
    url.searchParams.set('start_x', String(origin.lng));
    url.searchParams.set('start_y', String(origin.lat));
    url.searchParams.set('end_x', String(destination.lng));
    url.searchParams.set('end_y', String(destination.lat));
    url.searchParams.set('input_coord', 'WGS84');
    const options = this.apiProxyBaseUrl ? {} : { headers: { Authorization: `KakaoAK ${this.restApiKey}` } };
    const response = await this.fetchImpl(url, options);
    const payload = await responsePayload(response);
    if (!response.ok) return unavailable('transit', { ...(payload || {}), httpStatus: response.status }, failureFromPayload(payload, response.status));
    const route = bestTransitRoute(payload);
    if (!route?.properties?.totalTime) return unavailable('transit', payload, failureFromPayload(payload));
    return {
      mode: 'transit',
      durationMin: Math.max(1, Math.ceil(route.properties.totalTime / 60)),
      distanceM: Number.isFinite(route.properties.totalDistance) ? route.properties.totalDistance : null,
      fare: Number.isFinite(route.properties.fare?.value) ? route.properties.fare.value : null,
      transfers: Number.isFinite(route.properties.transfers) ? route.properties.transfers : null,
      legs: route.steps || [],
      providerStatus: 'confirmed',
      landingUrl: payload?.properties?.landingURL || null,
      raw: payload,
    };
  }

  async #walk(origin, destination) {
    if (this.walkEndpointUnavailable) return unavailable('walk', { httpStatus: 404 }, 'WALK_ENDPOINT_UNAVAILABLE');
    const url = this.apiProxyBaseUrl ? proxyUrl(this.apiProxyBaseUrl, 'walk') : new URL(WALK_URL);
    url.searchParams.set('start_x', String(origin.lng));
    url.searchParams.set('start_y', String(origin.lat));
    url.searchParams.set('end_x', String(destination.lng));
    url.searchParams.set('end_y', String(destination.lat));
    url.searchParams.set('input_coord', 'WGS84');
    const options = this.apiProxyBaseUrl ? {} : { headers: { Authorization: `KakaoAK ${this.restApiKey}` } };
    const response = await this.fetchImpl(url, options);
    const payload = await responsePayload(response);
    if (!response.ok) {
      if (response.status === 404) this.walkEndpointUnavailable = true;
      const reason = response.status === 404 ? 'WALK_ENDPOINT_UNAVAILABLE' : failureFromPayload(payload, response.status);
      return unavailable('walk', { ...(payload || {}), httpStatus: response.status }, reason);
    }
    const properties = payload?.route?.properties;
    if (!properties?.totalTime) return unavailable('walk', payload, failureFromPayload(payload));
    return {
      mode: 'walk',
      durationMin: Math.max(1, Math.ceil(properties.totalTime / 60)),
      distanceM: Number.isFinite(properties.totalDistance) ? properties.totalDistance : null,
      fare: null,
      transfers: null,
      legs: payload?.route?.legs || [],
      providerStatus: 'confirmed',
      landingUrl: properties.landingUrl || null,
      raw: payload,
    };
  }

  async #car(origin, destination) {
    const url = this.apiProxyBaseUrl ? proxyUrl(this.apiProxyBaseUrl, 'car') : new URL(CAR_URL);
    url.searchParams.set('origin', `${origin.lng},${origin.lat}`);
    url.searchParams.set('destination', `${destination.lng},${destination.lat}`);
    url.searchParams.set('priority', 'RECOMMEND');
    url.searchParams.set('summary', 'true');
    const options = this.apiProxyBaseUrl ? {} : { headers: { Authorization: `KakaoAK ${this.restApiKey}`, 'Content-Type': 'application/json' } };
    const response = await this.fetchImpl(url, options);
    const payload = await responsePayload(response);
    if (!response.ok) return unavailable('car', { ...(payload || {}), httpStatus: response.status }, failureFromPayload(payload, response.status));
    const summary = payload?.routes?.[0]?.summary;
    if (!summary?.duration) return unavailable('car', payload, failureFromPayload(payload));
    return {
      mode: 'car',
      durationMin: Math.max(1, Math.ceil(summary.duration / 60)),
      distanceM: Number.isFinite(summary.distance) ? summary.distance : null,
      fare: null,
      transfers: null,
      legs: [],
      providerStatus: 'confirmed',
      raw: payload,
    };
  }
}

export class EstimatedRouteProvider {
  async getRoute({ origin, destination, mode }) {
    const distanceM = haversineMeters(origin, destination);
    if (!Number.isFinite(distanceM)) return unavailable(mode, null, 'INVALID_DISTANCE');
    const km = distanceM / 1000;
    const durationMin = mode === 'car'
      ? Math.max(5, Math.ceil((km / 24) * 60 + 4))
      : mode === 'walk'
        ? Math.max(2, Math.ceil((km / 4.5) * 60))
        : Math.max(7, Math.ceil((km / 16) * 60 + 8));
    const fare = mode === 'transit' ? 1550 + Math.max(0, Math.floor((km - 10) / 5)) * 100 : null;
    return {
      mode,
      durationMin,
      distanceM: Math.round(distanceM),
      fare,
      transfers: mode === 'transit' ? (km > 7 ? 1 : 0) : null,
      legs: [],
      providerStatus: 'estimated',
      raw: null,
    };
  }
}

export class FallbackRouteProvider {
  constructor(primary, fallback = new EstimatedRouteProvider(), { walkFallbackMaxM = DEFAULT_WALK_FALLBACK_MAX_M } = {}) {
    this.primary = primary;
    this.fallback = fallback;
    this.walkFallbackMaxM = walkFallbackMaxM;
  }

  async getRoute(params) {
    const primaryResult = await this.primary.getRoute(params);
    if (primaryResult?.providerStatus !== 'unavailable' && primaryResult?.durationMin) return primaryResult;

    const primaryReason = primaryResult?.failureReason || failureFromPayload(primaryResult?.raw, primaryResult?.raw?.httpStatus || primaryResult?.raw?.status);
    const distanceM = haversineMeters(params.origin, params.destination);

    let walkFallbackReason = null;
    if (params.mode === 'transit' && Number.isFinite(distanceM) && distanceM <= this.walkFallbackMaxM) {
      const walking = await this.primary.getRoute({ ...params, mode: 'walk' });
      if (walking?.providerStatus === 'confirmed' && walking.durationMin) {
        return {
          ...walking,
          requestedMode: 'transit',
          fallbackReason: `TRANSIT_${primaryReason}_TO_WALK`,
          primaryFailureReason: primaryReason,
          providerStatus: 'confirmed',
        };
      }
      walkFallbackReason = walking?.failureReason || null;
    }

    const estimated = await this.fallback.getRoute(params);
    return {
      ...estimated,
      providerStatus: 'estimated',
      fallbackReason: primaryReason,
      primaryFailureReason: primaryReason,
      walkFallbackReason,
      primaryRaw: primaryResult?.raw || null,
    };
  }
}

export function createRouteProvider({ restApiKey = '', apiProxyBaseUrl = '', hasKakaoRestApiKey = Boolean(restApiKey), allowEstimatedWithoutKey = true } = {}) {
  const hasPrimary = Boolean(restApiKey || (apiProxyBaseUrl && hasKakaoRestApiKey));
  if (hasPrimary) {
    const primary = new KakaoRouteProvider({ restApiKey, apiProxyBaseUrl });
    return allowEstimatedWithoutKey ? new FallbackRouteProvider(primary) : primary;
  }
  return allowEstimatedWithoutKey ? new EstimatedRouteProvider() : new KakaoRouteProvider({ restApiKey: '', apiProxyBaseUrl: '' });
}
