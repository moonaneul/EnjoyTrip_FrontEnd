import { getJson, JsonParseError } from '../core/http.js';
import { normalizePlace, normalizePlaces } from '../features/explore/placeNormalizer.js';

export const TOUR_API_BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';

export const PLACE_TYPE_TO_CONTENT_TYPE_ID = Object.freeze({
  attraction: '12',
  culture: '14',
  event: '15',
  course: '25',
  lodging: '32',
  shopping: '38',
  food: '39',
});

const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map();
let localKeyPromise = null;

export class TourApiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TourApiConfigError';
  }
}

export class TourApiError extends Error {
  constructor(message, { resultCode = null, resultMsg = null, endpoint = null, cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'TourApiError';
    this.resultCode = resultCode;
    this.resultMsg = resultMsg;
    this.endpoint = endpoint;
  }
}

async function getServiceKey() {
  if (!localKeyPromise) {
    localKeyPromise = import('../config/keys.local.js')
      .then((module) => module.DATA_GO_KR_API_KEY)
      .catch(() => null);
  }

  const key = await localKeyPromise;
  if (!key || key === 'YOUR_DATA_GO_KR_DECODING_KEY') {
    throw new TourApiConfigError(
      'TourAPI 키가 없습니다. js/config/keys.example.js를 참고해 keys.local.js에 공공데이터포털 Decoding key를 설정하세요.',
    );
  }
  return key;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cacheKey(endpoint, params) {
  const query = new URLSearchParams();
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => query.set(key, String(value)));
  return `${endpoint}?${query.toString()}`;
}

function readCache(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCache(key, value) {
  responseCache.set(key, { createdAt: Date.now(), value });
  return value;
}

function parseXmlServiceError(text = '') {
  if (!text.includes('<OpenAPI_ServiceResponse>')) return null;

  const readTag = (tag) => {
    const match = text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
    return match?.[1]?.trim() || null;
  };

  return {
    resultCode: readTag('returnReasonCode'),
    resultMsg: readTag('returnAuthMsg') || readTag('errMsg'),
  };
}

function unwrapResponse(payload, endpoint) {
  const response = payload?.response;
  const header = response?.header;

  if (!response || !header) {
    throw new TourApiError('TourAPI 응답 구조가 예상과 다릅니다.', { endpoint });
  }

  if (String(header.resultCode) !== '0000') {
    throw new TourApiError(header.resultMsg || 'TourAPI 오류가 발생했습니다.', {
      resultCode: String(header.resultCode ?? ''),
      resultMsg: header.resultMsg || null,
      endpoint,
    });
  }

  const body = response.body || {};
  return {
    items: asArray(body.items?.item),
    pageNo: Number(body.pageNo || 1),
    numOfRows: Number(body.numOfRows || 0),
    totalCount: Number(body.totalCount || 0),
  };
}

async function request(endpoint, params = {}, options = {}) {
  const { cache = true, timeoutMs = 8000, debug = false, signal } = options;
  const serviceKey = await getServiceKey();
  const requestParams = {
    serviceKey,
    numOfRows: params.numOfRows ?? 20,
    pageNo: params.pageNo ?? 1,
    MobileOS: 'WEB',
    MobileApp: 'TEUM',
    _type: 'json',
    ...params,
  };

  const key = cacheKey(endpoint, { ...requestParams, serviceKey: '__KEY__' });
  if (cache) {
    const cached = readCache(key);
    if (cached) return cached;
  }

  try {
    const payload = await getJson(`${TOUR_API_BASE_URL}/${endpoint}`, requestParams, {
      timeoutMs,
      debug,
      signal,
    });
    const normalized = unwrapResponse(payload, endpoint);
    return cache ? writeCache(key, normalized) : normalized;
  } catch (error) {
    if (error instanceof JsonParseError) {
      const serviceError = parseXmlServiceError(error.bodySnippet);
      if (serviceError) {
        throw new TourApiError(serviceError.resultMsg || 'TourAPI 인증/게이트웨이 오류가 발생했습니다.', {
          ...serviceError,
          endpoint,
          cause: error,
        });
      }
    }
    throw error;
  }
}

function typeToContentTypeId(type) {
  if (!type) return null;
  const normalized = String(type).trim();
  if (/^\d+$/.test(normalized)) return normalized;
  return PLACE_TYPE_TO_CONTENT_TYPE_ID[normalized] || null;
}

function regionItem(item) {
  return {
    code: String(item.code ?? item.lDongRegnCd ?? item.lDongSignguCd ?? ''),
    name: String(item.name ?? item.lDongRegnNm ?? item.lDongSignguNm ?? ''),
  };
}

export async function getRegions(options = {}) {
  const result = await request('ldongCode2', {
    lDongListYn: 'N',
    numOfRows: 100,
    pageNo: 1,
  }, options);
  return result.items.map(regionItem).filter((region) => region.code && region.name);
}

export async function getSubregions(regionCode, options = {}) {
  if (!regionCode) return [];
  const result = await request('ldongCode2', {
    lDongRegnCd: regionCode,
    lDongListYn: 'N',
    numOfRows: 100,
    pageNo: 1,
  }, options);
  return result.items.map(regionItem).filter((region) => region.code && region.name);
}

export async function searchPlaces({
  areaCode,
  sigunguCode,
  type,
  page = 1,
  size = 20,
} = {}, options = {}) {
  const contentTypeId = typeToContentTypeId(type);
  const result = await request('areaBasedList2', {
    arrange: 'A',
    lDongRegnCd: areaCode || undefined,
    lDongSignguCd: sigunguCode || undefined,
    contentTypeId: contentTypeId || undefined,
    pageNo: page,
    numOfRows: size,
  }, options);
  return normalizePlaces(result.items);
}

export async function getNearbyPlaces({
  lat,
  lng,
  radius = 2000,
  type,
  page = 1,
  size = 20,
} = {}, options = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new TypeError('getNearbyPlaces에는 유효한 lat/lng가 필요합니다.');
  }

  const safeRadius = Math.min(Math.max(Number(radius) || 2000, 1), 20000);
  const contentTypeId = typeToContentTypeId(type);
  const result = await request('locationBasedList2', {
    arrange: 'E',
    mapX: longitude,
    mapY: latitude,
    radius: safeRadius,
    contentTypeId: contentTypeId || undefined,
    pageNo: page,
    numOfRows: size,
  }, options);
  return normalizePlaces(result.items);
}

export async function getPlaceDetail(contentId, contentTypeId, options = {}) {
  if (!contentId) throw new TypeError('contentId가 필요합니다.');

  const { strictIntro = false, ...requestOptions } = options;

  const common = await request('detailCommon2', {
    contentId,
    pageNo: 1,
    numOfRows: 10,
  }, requestOptions);

  const commonItem = common.items[0];
  if (!commonItem) {
    throw new TourApiError('해당 관광정보를 찾을 수 없습니다.', { endpoint: 'detailCommon2' });
  }

  const resolvedTypeId = String(contentTypeId || commonItem.contenttypeid || '');
  let introItem = null;

  if (resolvedTypeId) {
    try {
      const intro = await request('detailIntro2', {
        contentId,
        contentTypeId: resolvedTypeId,
        pageNo: 1,
        numOfRows: 10,
      }, requestOptions);
      introItem = intro.items[0] || null;
      if (strictIntro && !introItem) {
        throw new TourApiError('detailIntro2 응답이 비어 있습니다.', { endpoint: 'detailIntro2' });
      }
    } catch (error) {
      if (strictIntro) throw error;
      if (requestOptions.debug) console.warn('[TourAPI] detailIntro2 failed; detailCommon2만 사용합니다.', error);
    }
  } else if (strictIntro) {
    throw new TourApiError('detailIntro2 검증을 위한 contentTypeId가 없습니다.', { endpoint: 'detailIntro2' });
  }

  return normalizePlace(commonItem, { intro: introItem });
}

export function getFoodCandidates(params = {}, options = {}) {
  return searchPlaces({ ...params, type: 'food' }, options);
}

export function getLodgingCandidates(params = {}, options = {}) {
  return searchPlaces({ ...params, type: 'lodging' }, options);
}

export function clearTourApiCache() {
  responseCache.clear();
}

export const placeProvider = Object.freeze({
  getRegions,
  getSubregions,
  searchPlaces,
  getNearbyPlaces,
  getPlaceDetail,
  getFoodCandidates,
  getLodgingCandidates,
});
