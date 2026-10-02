const base = process.env.TEUM_BASE_URL || 'http://localhost:4173';

async function request(path) {
  const response = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  return { ok: response.ok, status: response.status, payload };
}

function pass(label, extra = '') { console.log(`PASS  ${label}${extra ? ` — ${extra}` : ''}`); }
function fail(label, extra = '') { console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ''}`); }
function warn(label, extra = '') { console.log(`WARN  ${label}${extra ? ` — ${extra}` : ''}`); }

console.log(`TEUM Kakao smoke test: ${base}`);

try {
  const config = await request('/api/runtime-config');
  if (!config.ok) throw new Error(`runtime-config HTTP ${config.status}`);
  if (!config.payload?.hasKakaoRestApiKey) {
    fail('REST API key', '.env.local 에 KAKAO_REST_API_KEY를 설정하세요.');
    process.exitCode = 1;
  } else {
    pass('REST API key', 'local proxy detected');
  }

  const geocode = await request(`/api/kakao/geocode?query=${encodeURIComponent('서울특별시 중구 세종대로 110')}`);
  const geoDoc = geocode.payload?.documents?.[0];
  if (geocode.ok && geoDoc?.x && geoDoc?.y) pass('Address geocode', `${geoDoc.address_name || '서울시청'} (${geoDoc.y}, ${geoDoc.x})`);
  else { fail('Address geocode', `HTTP ${geocode.status} ${JSON.stringify(geocode.payload)}`); process.exitCode = 1; }

  const keyword = await request(`/api/kakao/keyword?query=${encodeURIComponent('서울시청')}`);
  const keywordDoc = keyword.payload?.documents?.[0];
  if (keyword.ok && keywordDoc?.x && keywordDoc?.y) pass('Keyword place search', `${keywordDoc.place_name || '서울시청'} (${keywordDoc.y}, ${keywordDoc.x})`);
  else { fail('Keyword place search', `HTTP ${keyword.status} ${JSON.stringify(keyword.payload)}`); process.exitCode = 1; }

  const reverse = await request('/api/kakao/reverse-geocode?x=126.9780&y=37.5665&input_coord=WGS84');
  const reverseDoc = reverse.payload?.documents?.[0];
  if (reverse.ok && reverseDoc) pass('Reverse geocode', reverseDoc.road_address?.address_name || reverseDoc.address?.address_name || 'coordinate resolved');
  else { fail('Reverse geocode', `HTTP ${reverse.status} ${JSON.stringify(reverse.payload)}`); process.exitCode = 1; }

  const transit = await request('/api/kakao/transit?start_x=126.9780&start_y=37.5665&end_x=126.9769&end_y=37.5796&input_coord=WGS84');
  const bestTransit = transit.payload?.routes?.[0]?.properties;
  if (transit.ok && bestTransit?.totalTime) pass('Public transit route', `${Math.ceil(bestTransit.totalTime / 60)} min`);
  else { fail('Public transit route', `HTTP ${transit.status} ${JSON.stringify(transit.payload)}`); process.exitCode = 1; }

  const walk = await request('/api/kakao/walk?start_x=126.9780&start_y=37.5665&end_x=126.9769&end_y=37.5796&input_coord=WGS84');
  const walkSummary = walk.payload?.route?.properties;
  if (walk.ok && walkSummary?.totalTime) pass('Walking route', `${Math.ceil(walkSummary.totalTime / 60)} min / ${walkSummary.totalDistance} m`);
  else if (walk.status === 404) warn('Walking route', 'HTTP 404 — 현재 앱/환경에서는 도보 엔드포인트를 사용할 수 없어 거리 기반 fallback을 사용합니다.');
  else warn('Walking route', `HTTP ${walk.status} ${JSON.stringify(walk.payload)} — 도보는 보조 기능이므로 일정 생성은 fallback으로 계속됩니다.`);

  const car = await request('/api/kakao/car?origin=126.9780,37.5665&destination=126.9769,37.5796&priority=RECOMMEND&summary=true');
  const carSummary = car.payload?.routes?.[0]?.summary;
  if (car.ok && carSummary?.duration) pass('Car route', `${Math.ceil(carSummary.duration / 60)} min / ${carSummary.distance} m`);
  else { fail('Car route', `HTTP ${car.status} ${JSON.stringify(car.payload)}`); process.exitCode = 1; }
} catch (error) {
  fail('Local dev server', error?.message || String(error));
  console.log('먼저 다른 터미널에서 `npm run dev`를 실행하세요.');
  process.exitCode = 1;
}
