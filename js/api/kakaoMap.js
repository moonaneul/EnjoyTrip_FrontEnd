import { hasValidCoordinates } from '../features/recommendation/distance.js';

let loaderPromise;

export function loadKakaoMapSdk(javaScriptKey) {
  if (!javaScriptKey) return Promise.reject(new Error('KAKAO_JS_KEY_MISSING'));
  if (globalThis.kakao?.maps) return Promise.resolve(globalThis.kakao.maps);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(javaScriptKey)}&autoload=false`;
    script.onload = () => {
      if (!globalThis.kakao?.maps?.load) { reject(new Error('KAKAO_MAP_SDK_UNAVAILABLE')); return; }
      globalThis.kakao.maps.load(() => resolve(globalThis.kakao.maps));
    };
    script.onerror = () => reject(new Error('KAKAO_MAP_SDK_LOAD_FAILED'));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function placeTypeLabel(type) {
  return ({ attraction:'관광지', food:'음식점·카페', lodging:'숙박', culture:'문화', event:'행사', course:'코스', shopping:'쇼핑', unknown:'장소' })[type] || '장소';
}

function mapLink(point) {
  const name = encodeURIComponent(point.title || '장소');
  return `https://map.kakao.com/link/map/${name},${point.lat},${point.lng}`;
}

function markerInfoHtml(point, role) {
  const openText = point.openInfo?.status === 'confirmed_closed'
    ? (point.openInfo?.restDate || '휴무')
    : point.openInfo?.text || (point.openInfo?.status === 'unknown' ? '운영시간 확인 필요' : '운영시간 정보 없음');
  const image = point.imageUrl ? `<img src="${escapeHtml(point.imageUrl)}" alt="" style="width:100%;height:72px;object-fit:cover;border-radius:9px;margin:0 0 8px;display:block">` : '';
  return `<div class="teum-map-info" style="width:220px;padding:11px 12px 10px;line-height:1.4;color:#352d2a;background:#fffdfb;box-sizing:border-box">
    ${image}
    <div style="font-size:10px;font-weight:800;color:#f47769;margin-bottom:4px">${escapeHtml(role)} · ${escapeHtml(placeTypeLabel(point.type))}</div>
    <strong style="display:block;font-size:13px;margin-bottom:5px">${escapeHtml(point.title)}</strong>
    <div style="font-size:10px;color:#756b66;margin-bottom:3px">${escapeHtml(point.address || '주소 확인 필요')}</div>
    <div style="font-size:10px;color:#756b66;margin-bottom:3px">${escapeHtml(point.categoryPath || '')}</div>
    <div style="font-size:10px;color:#756b66;margin-bottom:8px">${escapeHtml(openText)}</div>
    <a href="${mapLink(point)}" target="_blank" rel="noopener" style="display:inline-block;font-size:10px;font-weight:800;color:#e76659;text-decoration:none">Kakao 지도에서 보기 →</a>
  </div>`;
}

function collectMapPoints(plan) {
  const items = [];
  (plan.places || []).forEach((entry, index) => {
    if (hasValidCoordinates(entry.place)) items.push({ point:entry.place, role:`Day ${entry.day || 1} · 일정 ${index + 1}`, priority:1 });
  });
  if (plan.lodging && hasValidCoordinates(plan.lodging)) items.push({ point:plan.lodging, role:'일정 반영 숙소', priority:2 });
  (plan.lodgingOptions || []).forEach((place, index) => {
    if (!hasValidCoordinates(place) || place.id === plan.lodging?.id) return;
    items.push({ point:place, role:`일정 반영 가능 숙소 ${index + 1}`, priority:3 });
  });
  const seen = new Set();
  return items.filter(({ point }) => {
    const key = point.id || `${point.lat},${point.lng}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export async function renderPlanMap(container, plan, { javaScriptKey } = {}) {
  if (!container || !plan) return { status: 'unavailable' };
  const points = collectMapPoints(plan);
  if (!points.length) return { status: 'unavailable' };

  try {
    const maps = await loadKakaoMapSdk(javaScriptKey);
    container.innerHTML = '';
    const center = new maps.LatLng(points[0].point.lat, points[0].point.lng);
    const map = new maps.Map(container, { center, level: 6 });
    const bounds = new maps.LatLngBounds();
    let openedInfo = null;
    const markers = [];

    points.forEach(({ point, role }) => {
      const position = new maps.LatLng(point.lat, point.lng);
      bounds.extend(position);
      const marker = new maps.Marker({ map, position, title: `${role} · ${point.title}`, clickable:true });
      if (typeof marker.setClickable === 'function') marker.setClickable(true);
      const info = new maps.InfoWindow({ content:markerInfoHtml(point, role) });
      maps.event.addListener(marker, 'click', () => {
        if (openedInfo && openedInfo !== info) openedInfo.close();
        info.open(map, marker);
        openedInfo = info;
        map.panTo(position);
      });
      markers.push(marker);
    });
    maps.event.addListener(map, 'click', () => {
      if (openedInfo) { openedInfo.close(); openedInfo = null; }
    });
    map.setBounds(bounds);
    return { status: 'confirmed', map, markers };
  } catch (error) {
    return { status: 'unavailable', error };
  }
}

export async function geocodeAddress(address, options = {}) {
  if (!address?.trim()) return null;
  const normalized = typeof options === 'string' ? { restApiKey: options } : (options || {});
  const { restApiKey = '', apiProxyBaseUrl = '', hasKakaoRestApiKey = Boolean(restApiKey) } = normalized;
  if (!hasKakaoRestApiKey && !restApiKey) return null;

  const url = apiProxyBaseUrl
    ? new URL(`${apiProxyBaseUrl.replace(/\/$/, '')}/geocode`, globalThis.location?.origin || 'http://localhost')
    : new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.set('query', address.trim());

  try {
    const fetchOptions = apiProxyBaseUrl ? {} : { headers: { Authorization: `KakaoAK ${restApiKey}` } };
    const response = await fetch(url, fetchOptions);
    if (!response.ok) return null;
    const payload = await response.json();
    const first = payload?.documents?.[0];
    if (!first) return null;
    return { source: 'manual', label: first.address_name || address.trim(), lat: Number(first.y), lng: Number(first.x) };
  } catch {
    return null;
  }
}


export async function reverseGeocodeCoordinates(origin, options = {}) {
  if (!hasValidCoordinates(origin)) return null;
  const normalized = typeof options === 'string' ? { restApiKey: options } : (options || {});
  const { restApiKey = '', apiProxyBaseUrl = '', hasKakaoRestApiKey = Boolean(restApiKey) } = normalized;
  if (!hasKakaoRestApiKey && !restApiKey) return null;

  const url = apiProxyBaseUrl
    ? new URL(`${apiProxyBaseUrl.replace(/\/$/, '')}/reverse-geocode`, globalThis.location?.origin || 'http://localhost')
    : new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json');
  url.searchParams.set('x', String(origin.lng));
  url.searchParams.set('y', String(origin.lat));
  url.searchParams.set('input_coord', 'WGS84');

  try {
    const fetchOptions = apiProxyBaseUrl ? {} : { headers: { Authorization: `KakaoAK ${restApiKey}` } };
    const response = await fetch(url, fetchOptions);
    if (!response.ok) return null;
    const payload = await response.json();
    const first = payload?.documents?.[0];
    if (!first) return null;
    const road = first.road_address || null;
    const addr = first.address || null;
    const regionLabel = [addr?.region_1depth_name, addr?.region_2depth_name, addr?.region_3depth_name].filter(Boolean).join(' ');
    const buildingName = road?.building_name?.trim();
    const fullAddress = road?.address_name || addr?.address_name || regionLabel;
    const label = buildingName || regionLabel || fullAddress || '현재 위치';
    return { label, address: fullAddress || label, roadAddress: road?.address_name || null, raw: first };
  } catch {
    return null;
  }
}

export async function searchPlaceKeyword(query, options = {}) {
  if (!query?.trim()) return null;
  const normalized = typeof options === 'string' ? { restApiKey: options } : (options || {});
  const { restApiKey = '', apiProxyBaseUrl = '', hasKakaoRestApiKey = Boolean(restApiKey), origin = null } = normalized;
  if (!hasKakaoRestApiKey && !restApiKey) return null;

  const url = apiProxyBaseUrl
    ? new URL(`${apiProxyBaseUrl.replace(/\/$/, '')}/keyword`, globalThis.location?.origin || 'http://localhost')
    : new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', query.trim());
  if (hasValidCoordinates(origin)) {
    url.searchParams.set('x', String(origin.lng));
    url.searchParams.set('y', String(origin.lat));
    url.searchParams.set('radius', '20000');
  }

  try {
    const fetchOptions = apiProxyBaseUrl ? {} : { headers: { Authorization: `KakaoAK ${restApiKey}` } };
    const response = await fetch(url, fetchOptions);
    if (!response.ok) return null;
    const payload = await response.json();
    const first = payload?.documents?.[0];
    if (!first) return null;
    return {
      source:'keyword',
      label:first.place_name || query.trim(),
      address:first.road_address_name || first.address_name || query.trim(),
      roadAddress:first.road_address_name || null,
      lat:Number(first.y),
      lng:Number(first.x),
      placeUrl:first.place_url || null,
    };
  } catch {
    return null;
  }
}
