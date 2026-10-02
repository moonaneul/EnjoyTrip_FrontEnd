import assert from 'node:assert/strict';
import { mockPlaceProvider, MOCK_PLACES } from '../js/mocks/tourApi.mock.js';
import { EstimatedRouteProvider, KakaoRouteProvider, FallbackRouteProvider, createRouteProvider } from '../js/api/kakaoRoute.js';
import { generatePlans } from '../js/features/recommendation/generatePlans.js';
import { minutesBetween } from '../js/features/recommendation/time.js';
import { validatePlannerInput } from '../js/features/planner/validation.js';
import { saveTrip, listTrips, deleteTrip, TRIP_STORAGE_KEY } from '../js/core/tripStorage.js';
import { findQuickOrigin } from '../js/features/planner/locationCatalog.js';
import { searchPlaceKeyword } from '../js/api/kakaoMap.js';

const input = {
  origin: { source:'manual', label:'서울시청', lat:37.5665, lng:126.9780 },
  tripSpan:'day',
  startAt:new Date('2026-10-02T14:00:00+09:00'),
  endAt:new Date('2026-10-02T19:00:00+09:00'),
  transport:'transit', returnMode:'origin', accommodation:false, moods:['산책','문화'],
};

assert.equal(MOCK_PLACES.length >= 50, true, 'mock fixture should cover Seoul + Gwangju');
assert.equal(MOCK_PLACES.some((p)=>p.address.startsWith('광주')), true, 'Gwangju fixtures required');
assert.equal(MOCK_PLACES.filter((p)=>p.type==='lodging' && p.address.startsWith('광주')).length >= 5, true, 'Gwangju requires at least five lodging fixtures');
assert.equal(MOCK_PLACES.some((p)=>p.openInfo.status === 'confirmed_closed'), true, 'closed fixture required');
assert.equal(MOCK_PLACES.some((p)=>p.openInfo.status === 'unknown'), true, 'unknown fixture required');
assert.equal(validatePlannerInput(input).valid, true);
assert.equal(minutesBetween(input.startAt,input.endAt),300);
assert.equal(validatePlannerInput({ ...input, endAt:new Date('2026-10-02T13:00:00+09:00') }).valid,false,'start>=end must fail');
assert.equal(findQuickOrigin('광주 충장로')?.id,'gwangju-acc','offline origin search should resolve Gwangju central query');

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({ ok:true, json:async()=>({ documents:[{ place_name:'전남대학교', address_name:'광주 북구 용봉동 300', road_address_name:'광주 북구 용봉로 77', x:'126.9119', y:'35.1766', place_url:'https://place.map.kakao.com/1' }] }) });
const keywordOrigin = await searchPlaceKeyword('전남대학교', { restApiKey:'test' });
assert.equal(keywordOrigin?.label,'전남대학교','keyword place search should resolve POI names');
assert.equal(keywordOrigin?.address,'광주 북구 용봉로 77');
globalThis.fetch = originalFetch;

const plans = await generatePlans({ input, placeProvider:mockPlaceProvider, routeProvider:new EstimatedRouteProvider(), config:{seed:42} });
console.log('seoul day plans', plans.map((p)=>({ type:p.type, places:p.places.map((x)=>x.place.title), end:p.returnAt.toISOString(), travel:p.totalTravelMin })));
assert.equal(plans.length,3,'5h Seoul sample should produce 3 plans');
assert.equal(plans.every((p)=>Boolean(p.strategyLabel)),true,'all generated plans should expose personalized strategy labels');
assert.equal(new Set(plans.map((p)=>p.strategyLabel)).size,3,'three generated plans should have distinct strategy labels');
assert.deepEqual(plans.map((p)=>p.type),['slow','full','random']);
for (const plan of plans) {
  assert.equal(plan.returnAt <= input.endAt,true,`${plan.type} must return before deadline`);
  assert.equal(plan.places.every((x)=>x.place.openInfo.status !== 'confirmed_closed'),true,'closed place must be excluded');
  assert.equal(plan.lodging,null,'stay OFF should not attach lodging');
}
assert.equal(plans[0].places.length <= plans[1].places.length,true,'slow should not exceed full place count');
assert.equal(plans[2].theme != null,true,'random theme required');

const plansAgain = await generatePlans({ input, placeProvider:mockPlaceProvider, routeProvider:new EstimatedRouteProvider(), config:{seed:42} });
assert.deepEqual(plans.find((p)=>p.type==='random').places.map((p)=>p.place.id), plansAgain.find((p)=>p.type==='random').places.map((p)=>p.place.id),'same seed should reproduce random sequence');

const shortInput = { ...input, startAt:new Date('2026-10-02T15:00:00+09:00'), endAt:new Date('2026-10-02T17:30:00+09:00') };
const shortPlans = await generatePlans({ input:shortInput, placeProvider:mockPlaceProvider, routeProvider:new EstimatedRouteProvider(), config:{seed:42} });
assert.equal(shortPlans.length >= 1,true,'2.5h sample should produce at least one micro trip');
for (const plan of shortPlans) assert.equal(plan.returnAt <= shortInput.endAt,true);

const stayInput = { ...input, accommodation:true };
const stayPlans = await generatePlans({ input:stayInput, placeProvider:mockPlaceProvider, routeProvider:new EstimatedRouteProvider(), config:{seed:42} });
assert.equal(stayPlans.length >= 1,true,'stay mode should produce at least one plan');
assert.equal(stayPlans.every((p)=>p.lodging),true,'stay plans require lodging');
assert.equal(stayPlans.every((p)=>(p.lodgingVariants || []).length > 0),true,'stay recommendations must be schedule-validated variants');
for (const plan of stayPlans) {
  for (const variant of plan.lodgingVariants || []) assert.equal(variant.returnAt <= stayInput.endAt,true,'day-stay lodging option must fit the requested window');
}

const emptyProvider = { getNearbyPlaces:async()=>[], getLodgingCandidates:async()=>[] };
const emptyPlans = await generatePlans({ input, placeProvider:emptyProvider, routeProvider:new EstimatedRouteProvider() });
assert.equal(emptyPlans.length,0,'no candidate should return empty list');
assert.equal(emptyPlans.meta.reason,'NO_CANDIDATES');

const transitFetch = async () => ({ ok:true, json:async()=>({ routes:[{ properties:{ totalTime:610,totalDistance:3200,transfers:1,fare:{value:1550}}, steps:[{properties:{type:'BUS'}}] }] }) });
const transit = await new KakaoRouteProvider({ restApiKey:'test', fetchImpl:transitFetch }).getRoute({ origin:input.origin,destination:MOCK_PLACES[0],mode:'transit' });
assert.equal(transit.providerStatus,'confirmed'); assert.equal(transit.durationMin,11); assert.equal(transit.fare,1550); assert.equal(transit.transfers,1);

const walkFetch = async () => ({ ok:true, json:async()=>({ route:{ properties:{ totalTime:480,totalDistance:620,landingUrl:'https://map.kakao.com/' }, legs:[] } }) });
const walk = await new KakaoRouteProvider({ restApiKey:'test', fetchImpl:walkFetch }).getRoute({ origin:input.origin,destination:{...input.origin,lat:37.571},mode:'walk' });
assert.equal(walk.providerStatus,'confirmed'); assert.equal(walk.mode,'walk'); assert.equal(walk.durationMin,8); assert.equal(walk.distanceM,620);

let walk404Calls = 0;
const walk404Provider = new KakaoRouteProvider({ restApiKey:'test', fetchImpl:async()=>{ walk404Calls += 1; return { ok:false, status:404, json:async()=>null }; } });
const walk404First = await walk404Provider.getRoute({ origin:input.origin,destination:{...input.origin,lat:37.571},mode:'walk' });
const walk404Second = await walk404Provider.getRoute({ origin:input.origin,destination:{...input.origin,lat:37.572},mode:'walk' });
assert.equal(walk404First.failureReason,'WALK_ENDPOINT_UNAVAILABLE');
assert.equal(walk404Second.failureReason,'WALK_ENDPOINT_UNAVAILABLE');
assert.equal(walk404Calls,1,'walking 404 should disable repeated endpoint calls for the provider instance');

const carFetch = async () => ({ ok:true, json:async()=>({ routes:[{ summary:{ duration:721,distance:8450,fare:{taxi:12000,toll:0} } }] }) });
const car = await new KakaoRouteProvider({ restApiKey:'test', fetchImpl:carFetch }).getRoute({ origin:input.origin,destination:MOCK_PLACES[0],mode:'car' });
assert.equal(car.providerStatus,'confirmed'); assert.equal(car.durationMin,13); assert.equal(car.distanceM,8450); assert.equal(car.fare,null);

const failedPrimary = new KakaoRouteProvider({ restApiKey:'test', fetchImpl:async()=>({ok:false,status:403}) });
const failed = await failedPrimary.getRoute({ origin:input.origin,destination:MOCK_PLACES[0],mode:'transit' });
assert.equal(failed.providerStatus,'unavailable','raw Kakao provider failure remains unavailable');
const fallbackRoute = await new FallbackRouteProvider(failedPrimary).getRoute({ origin:input.origin,destination:MOCK_PLACES[0],mode:'transit' });
assert.equal(fallbackRoute.providerStatus,'estimated','403 must fall back to estimate');
assert.equal(fallbackRoute.fallbackReason,'HTTP_403');

const nearDestination = { ...input.origin, title:'가까운 장소', lat:37.5700, lng:126.9780 };
const walkFallbackPrimary = {
  async getRoute({ mode }) {
    if (mode === 'transit') return { mode:'transit', durationMin:0, providerStatus:'unavailable', failureReason:'NO_RESULTS', raw:{status:'NO_RESULTS'} };
    if (mode === 'walk') return { mode:'walk', durationMin:6, distanceM:430, fare:null, transfers:null, legs:[], providerStatus:'confirmed', raw:{} };
    throw new Error('unexpected mode');
  },
};
const nearFallback = await new FallbackRouteProvider(walkFallbackPrimary).getRoute({ origin:input.origin,destination:nearDestination,mode:'transit' });
assert.equal(nearFallback.providerStatus,'confirmed','near transit failure should use confirmed walking route');
assert.equal(nearFallback.mode,'walk');
assert.equal(nearFallback.requestedMode,'transit');
assert.equal(nearFallback.primaryFailureReason,'NO_RESULTS');

let proxyRequest = null;
const proxyFetch = async (url,options={}) => { proxyRequest={url:String(url),options}; return { ok:true, json:async()=>({ routes:[{ properties:{ totalTime:600,totalDistance:2000,transfers:0,fare:{value:1550}}, steps:[] }] }) }; };
const proxyTransit = await new KakaoRouteProvider({ apiProxyBaseUrl:'/api/kakao', fetchImpl:proxyFetch }).getRoute({ origin:input.origin,destination:MOCK_PLACES[0],mode:'transit' });
assert.equal(proxyTransit.providerStatus,'confirmed');
assert.equal(proxyRequest.url.includes('/api/kakao/transit'),true); assert.equal(Boolean(proxyRequest.options?.headers?.Authorization),false);
assert.equal(createRouteProvider({ apiProxyBaseUrl:'/api/kakao', hasKakaoRestApiKey:false }) instanceof EstimatedRouteProvider,true);
assert.equal(createRouteProvider({ apiProxyBaseUrl:'/api/kakao', hasKakaoRestApiKey:true }) instanceof FallbackRouteProvider,true);

// Gwangju 5h must work even if primary Kakao transit is 403, via estimated fallback.
const gwangjuInput = {
  ...input,
  origin:{ source:'preset', label:'광주 · 국립아시아문화전당', lat:35.1466, lng:126.9199 },
};
const always403 = new FallbackRouteProvider(new KakaoRouteProvider({ restApiKey:'test', fetchImpl:async()=>({ok:false,status:403}) }));
const gwangjuPlans = await generatePlans({ input:gwangjuInput, placeProvider:mockPlaceProvider, routeProvider:always403, config:{seed:42} });
console.log('gwangju 5h plans', gwangjuPlans.map((p)=>({type:p.type,places:p.places.map((x)=>x.place.title),end:p.returnAt.toISOString()})));
assert.equal(gwangjuPlans.length,3,'Gwangju 5h should produce 3 plans');
assert.equal(gwangjuPlans.every((p)=>p.places.every((x)=>x.place.address.startsWith('광주'))),true,'Gwangju plans should use local fixtures');
assert.equal(gwangjuPlans.some((p)=>p.warnings.some((w)=>w.includes('Kakao 경로 응답 실패'))),true,'fallback warning required');

// 1-night/2-day: Day1 -> lodging -> Day2 -> origin, with final return hard gate.
const overnightInput = {
  ...gwangjuInput,
  tripSpan:'overnight', accommodation:true,
  startAt:new Date('2026-10-02T14:00:00+09:00'),
  endAt:new Date('2026-10-03T19:00:00+09:00'),
};
assert.equal(validatePlannerInput(overnightInput).valid,true,'overnight input should validate');
const overnightPlans = await generatePlans({ input:overnightInput, placeProvider:mockPlaceProvider, routeProvider:new EstimatedRouteProvider(), config:{seed:42} });
console.log('gwangju overnight plans', overnightPlans.map((p)=>({type:p.type,days:[...new Set(p.places.map((x)=>x.day))],lodging:p.lodging?.title,end:p.returnAt.toISOString()})));
assert.equal(overnightPlans.length,3,'Gwangju overnight should produce 3 plans');
for (const plan of overnightPlans) {
  assert.equal(plan.tripSpan,'overnight');
  assert.equal(Boolean(plan.lodging),true,'overnight requires lodging');
  assert.deepEqual([...new Set(plan.places.map((x)=>x.day))],[1,2],'overnight must have Day1 and Day2 places');
  assert.equal(plan.returnAt <= overnightInput.endAt,true,'Day2 return hard gate required');
  assert.equal(plan.lodgingArrivalAt < plan.day2StartAt,true,'lodging must occur before Day2 start');
  assert.equal(plan.lodgingOptions.length,5,'overnight should expose five schedule-validated lodging options when available');
  assert.equal(plan.lodgingVariants.length,5,'each lodging option must have a fully recalculated schedule variant');
  assert.deepEqual(plan.lodgingVariants.map((variant)=>variant.lodging.id), plan.lodgingOptions.map((place)=>place.id),'lodging variants and visible options must match');
  for (const variant of plan.lodgingVariants) {
    assert.equal(Boolean(variant.lodging),true,'every lodging variant needs a lodging');
    assert.equal(variant.returnAt <= overnightInput.endAt,true,'every recommended lodging must pass the final return hard gate');
    assert.equal(variant.lodgingArrivalAt < variant.day2StartAt,true,'every recommended lodging must fit between Day1 and Day2');
    assert.deepEqual([...new Set(variant.places.map((x)=>x.day))],[1,2],'every lodging variant must retain Day1 and Day2 itinerary');
    assert.equal(Array.isArray(variant.routeDiagnostics),true,'every lodging variant requires route diagnostics');
  }
  assert.equal(plan.routeDiagnostics.length > 0,true,'route diagnostics should be attached');
  const byDay = new Map();
  for (const entry of plan.places) {
    const list = byDay.get(entry.day) || [];
    list.push(entry.place.type);
    byDay.set(entry.day, list);
  }
  for (const types of byDay.values()) {
    for (let i = 1; i < types.length; i += 1) assert.equal(!(types[i] === 'food' && types[i - 1] === 'food'), true, 'overnight should not place food stops back-to-back');
  }
}

const tooLong = validatePlannerInput({ ...overnightInput, endAt:new Date('2026-10-04T19:00:00+09:00') });
assert.equal(tooLong.valid,false,'2 nights must be rejected');

const memory = new Map();
globalThis.localStorage = { getItem:(k)=>memory.has(k)?memory.get(k):null, setItem:(k,v)=>memory.set(k,String(v)), removeItem:(k)=>memory.delete(k) };
const trip = saveTrip({ plannerInput:overnightInput, plan:overnightPlans[0], ownerUserId:null });
assert.equal(listTrips().length,1); assert.equal(listTrips()[0].ownerUserId,null); assert.equal(deleteTrip(trip.id),true); assert.equal(listTrips().length,0);
localStorage.setItem(TRIP_STORAGE_KEY,'{broken json'); assert.deepEqual(listTrips(),[]); assert.equal(localStorage.getItem(TRIP_STORAGE_KEY),null);

console.log('DEV2 domain tests passed');
