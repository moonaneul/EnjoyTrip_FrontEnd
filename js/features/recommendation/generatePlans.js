import { validatePlannerInput } from '../planner/validation.js';
import { haversineMeters, hasValidCoordinates } from './distance.js';
import { addMinutes, minutesBetween } from './time.js';
import { CachedRouteProvider } from './routeCache.js';
import { DEFAULT_RECOMMENDATION_CONFIG } from './config.js';
import { scorePlacePreference } from '../preferences/preferenceScoring.js';
import { buildPersonalizedStrategies, preferenceForStrategy, personalizedTargetCount, strategyDwellScale, strategySafetyBuffer, strategyTitle } from './personalizedStrategies.js';

const TYPE_DWELL = { attraction:60, culture:55, event:55, course:65, shopping:45, food:50, lodging:20, unknown:45 };
function uniqById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.id || item?.place?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  });
}

function plannerMoodScore(place, moods) {
  let score = 0;
  for (const mood of moods || []) {
    if (mood === '산책' && ['attraction','course'].includes(place.type)) score += 4;
    if (mood === '카페' && place.type === 'food') score += 3;
    if (mood === '문화' && ['culture','event'].includes(place.type)) score += 4;
  }
  return score;
}

function hasMealWindow(startAt, endAt) {
  const start = startAt.getHours() * 60 + startAt.getMinutes();
  const end = endAt.getHours() * 60 + endAt.getMinutes();
  const overlaps = (from, to) => start < to && end > from;
  return overlaps(11 * 60 + 30, 14 * 60 + 30) || overlaps(17 * 60 + 30, 20 * 60 + 30);
}

function createRng(seed) {
  let a = Number(seed) || 1;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function shuffle(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length); let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor; cursor += 1;
      try { results[index] = { status:'fulfilled', value:await mapper(items[index], index) }; }
      catch (reason) { results[index] = { status:'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length:Math.min(limit, items.length) }, () => worker()));
  return results;
}

function selectBaseCandidates(routed, input, effectivePreference = null) {
  return [...routed].sort((a, b) => {
    const prefA = scorePlacePreference(a.place, effectivePreference, { distanceM:a.distanceM });
    const prefB = scorePlacePreference(b.place, effectivePreference, { distanceM:b.distanceM });
    const moodA = plannerMoodScore(a.place, input.moods) / 8;
    const moodB = plannerMoodScore(b.place, input.moods) / 8;
    const combinedA = prefA * 0.76 + moodA * 0.24;
    const combinedB = prefB * 0.76 + moodB * 0.24;
    if (Math.abs(combinedB - combinedA) > 0.01) return combinedB - combinedA;
    const openA = a.place.openInfo?.status === 'confirmed_open' ? 0 : 1;
    const openB = b.place.openInfo?.status === 'confirmed_open' ? 0 : 1;
    if (openA !== openB) return openA - openB;
    return a.distanceM - b.distanceM;
  });
}

function personalizationReason(effectivePreference, input, strategy) {
  if (!strategy) return null;
  if (effectivePreference?.source === 'neutral') {
    const override = (input.moods || []).length ? `이번 여행의 ${(input.moods || []).join(' · ')} 분위기` : '이번 여행 조건';
    return `${override}을 기준으로 ${strategy.tagline}`;
  }
  return strategy.tagline;
}

function dwellMinutes(place, effectivePreference, strategy, { micro = false, overnight = false } = {}) {
  const base = TYPE_DWELL[place.type] || 45;
  const scale = strategyDwellScale(effectivePreference, strategy, { micro, overnight });
  return Math.max(micro ? 30 : 35, Math.round(base * scale));
}

function routeHasEstimate(route) { return route?.providerStatus === 'estimated'; }
function addRouteCost(acc, route) {
  acc.travel += route.durationMin || 0;
  if (Number.isFinite(route.fare)) { acc.cost += route.fare; acc.hasFare = true; }
  if (route?.mode === 'walk' && route?.requestedMode === 'transit') acc.walking = true;
  if (routeHasEstimate(route)) { acc.estimated = true; if (route.fallbackReason) acc.fallback = true; }
}
function appendEstimateWarning(warnings, metrics) {
  if (metrics.walking) warnings.push('가까운 일부 구간은 대중교통 경로 대신 Kakao 도보 경로를 사용했습니다.');
  if (!metrics.estimated) return;
  warnings.push(metrics.fallback
    ? '일부 경로는 Kakao 경로 응답 실패로 거리 기반 예상값을 사용했습니다.'
    : '일부 이동시간/요금은 거리 기반 예상값입니다.');
}

async function buildDayPlan({ type, strategy, effectivePreference, title, theme = null, selected, input, routeProvider, safetyBufferMin, lodging = null, lodgingOptions = [] }) {
  if (!selected.length) return null;
  const places = [], warnings = [], metrics = { travel:0, cost:0, hasFare:false, estimated:false, fallback:false, walking:false };
  let cursor = new Date(input.startAt), current = input.origin;
  const micro = minutesBetween(input.startAt, input.endAt) < 180;

  for (const item of selected) {
    const place = item.place || item;
    const route = await routeProvider.getRoute({ origin:current, destination:place, mode:input.transport });
    if (!route || route.providerStatus === 'unavailable' || !route.durationMin) return null;
    addRouteCost(metrics, route);
    cursor = addMinutes(cursor, route.durationMin);
    const dwellMin = dwellMinutes(place, effectivePreference, strategy, { micro });
    const arriveAt = new Date(cursor); cursor = addMinutes(cursor, dwellMin); const leaveAt = new Date(cursor);
    if (place.openInfo?.status === 'unknown') warnings.push(`${place.title}: 운영시간 확인 필요`);
    places.push({ place, day:1, arriveAt, leaveAt, dwellMin, travelFromPrevious:route });
    current = place;
  }

  let returnRoute = null, lodgingRoute = null, lodgingArrivalAt = null;
  if (input.accommodation && lodging) {
    lodgingRoute = await routeProvider.getRoute({ origin:current, destination:lodging, mode:input.transport });
    if (!lodgingRoute || lodgingRoute.providerStatus === 'unavailable' || !lodgingRoute.durationMin) return null;
    addRouteCost(metrics, lodgingRoute); cursor = addMinutes(cursor, lodgingRoute.durationMin); lodgingArrivalAt = new Date(cursor);
  } else {
    returnRoute = await routeProvider.getRoute({ origin:current, destination:input.origin, mode:input.transport });
    if (!returnRoute || returnRoute.providerStatus === 'unavailable' || !returnRoute.durationMin) return null;
    addRouteCost(metrics, returnRoute); cursor = addMinutes(cursor, returnRoute.durationMin);
  }

  const hardDeadline = addMinutes(input.endAt, -safetyBufferMin);
  if (cursor > hardDeadline) return null;
  appendEstimateWarning(warnings, metrics);
  return {
    id:`${type}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, type, strategyId:strategy?.id || type, strategyLabel:strategy?.label || null, strategyIcon:strategy?.icon || null, strategyTag:strategy?.tag || null, strategyTagline:strategy?.tagline || null, strategy, theme, title, tripSpan:'day', dayCount:1,
    areaLabel:selected[0]?.place?.categoryPath?.split(' · ')[0] || selected[0]?.place?.address?.split(' ').slice(0,2).join(' ') || '가까운 여행',
    startAt:new Date(input.startAt), returnAt:new Date(cursor), totalDurationMin:minutesBetween(input.startAt, cursor), activeDurationMin:places.reduce((s,p)=>s+p.dwellMin,0)+metrics.travel,
    transportCost:metrics.hasFare && input.transport === 'transit' ? metrics.cost : null, totalTravelMin:metrics.travel, places,
    lodging:input.accommodation ? lodging : null, lodgingOptions:input.accommodation ? lodgingOptions : [], warnings:[...new Set(warnings)], returnRoute, lodgingRoute, lodgingArrivalAt, safetyBufferMin,
  };
}

function overnightDay2Start(input) {
  const start = new Date(input.endAt);
  start.setHours(9, 30, 0, 0);
  if (minutesBetween(start, input.endAt) < 150) return addMinutes(input.endAt, -180);
  return start;
}

function overnightSplitIndex(length, input) {
  if (length < 2) return 1;
  const day1Deadline = new Date(input.startAt); day1Deadline.setHours(22, 30, 0, 0);
  const day2Start = overnightDay2Start(input);
  const day1Capacity = Math.max(60, minutesBetween(input.startAt, day1Deadline));
  const day2Capacity = Math.max(60, minutesBetween(day2Start, input.endAt));
  const share = day1Capacity / (day1Capacity + day2Capacity);
  return Math.max(1, Math.min(length - 1, Math.round(length * share)));
}

function splitOvernight(selected, input) {
  if (selected.length < 2) return { day1:[], day2:[] };
  const cut = overnightSplitIndex(selected.length, input);
  return { day1:selected.slice(0, cut), day2:selected.slice(cut) };
}

async function buildOvernightPlan({ type, strategy, effectivePreference, title, theme = null, selected, input, routeProvider, safetyBufferMin, lodging, lodgingOptions = [] }) {
  if (!lodging || selected.length < 2) return null;
  const { day1, day2 } = splitOvernight(selected, input);
  if (!day1.length || !day2.length) return null;
  const places = [], warnings = [], metrics = { travel:0, cost:0, hasFare:false, estimated:false, fallback:false, walking:false };
  let cursor = new Date(input.startAt), current = input.origin;
  const day1Deadline = new Date(input.startAt); day1Deadline.setHours(22, 30, 0, 0);

  for (const item of day1) {
    const place = item.place || item;
    const route = await routeProvider.getRoute({ origin:current, destination:place, mode:input.transport });
    if (!route || route.providerStatus === 'unavailable' || !route.durationMin) return null;
    addRouteCost(metrics, route); cursor = addMinutes(cursor, route.durationMin);
    const dwellMin = dwellMinutes(place, effectivePreference, strategy, { overnight:true });
    const arriveAt = new Date(cursor); cursor = addMinutes(cursor, dwellMin); const leaveAt = new Date(cursor);
    if (place.openInfo?.status === 'unknown') warnings.push(`${place.title}: 운영시간 확인 필요`);
    places.push({ place, day:1, arriveAt, leaveAt, dwellMin, travelFromPrevious:route }); current = place;
  }

  const lodgingRoute = await routeProvider.getRoute({ origin:current, destination:lodging, mode:input.transport });
  if (!lodgingRoute || lodgingRoute.providerStatus === 'unavailable' || !lodgingRoute.durationMin) return null;
  addRouteCost(metrics, lodgingRoute); cursor = addMinutes(cursor, lodgingRoute.durationMin);
  const lodgingArrivalAt = new Date(cursor);
  if (lodgingArrivalAt > day1Deadline) return null;

  const day2StartAt = overnightDay2Start(input);
  cursor = new Date(day2StartAt); current = lodging;
  for (const item of day2) {
    const place = item.place || item;
    const route = await routeProvider.getRoute({ origin:current, destination:place, mode:input.transport });
    if (!route || route.providerStatus === 'unavailable' || !route.durationMin) return null;
    addRouteCost(metrics, route); cursor = addMinutes(cursor, route.durationMin);
    const dwellMin = dwellMinutes(place, effectivePreference, strategy, { overnight:true });
    const arriveAt = new Date(cursor); cursor = addMinutes(cursor, dwellMin); const leaveAt = new Date(cursor);
    if (place.openInfo?.status === 'unknown') warnings.push(`${place.title}: 운영시간 확인 필요`);
    places.push({ place, day:2, arriveAt, leaveAt, dwellMin, travelFromPrevious:route }); current = place;
  }

  const returnRoute = await routeProvider.getRoute({ origin:current, destination:input.origin, mode:input.transport });
  if (!returnRoute || returnRoute.providerStatus === 'unavailable' || !returnRoute.durationMin) return null;
  addRouteCost(metrics, returnRoute); cursor = addMinutes(cursor, returnRoute.durationMin);
  if (cursor > addMinutes(input.endAt, -safetyBufferMin)) return null;
  appendEstimateWarning(warnings, metrics);
  return {
    id:`${type}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, type, strategyId:strategy?.id || type, strategyLabel:strategy?.label || null, strategyIcon:strategy?.icon || null, strategyTag:strategy?.tag || null, strategyTagline:strategy?.tagline || null, strategy, theme, title, tripSpan:'overnight', dayCount:2,
    areaLabel:selected[0]?.place?.categoryPath?.split(' · ')[0] || '가까운 여행', startAt:new Date(input.startAt), returnAt:new Date(cursor),
    totalDurationMin:minutesBetween(input.startAt, cursor), activeDurationMin:places.reduce((s,p)=>s+p.dwellMin,0)+metrics.travel,
    transportCost:metrics.hasFare && input.transport === 'transit' ? metrics.cost : null, totalTravelMin:metrics.travel, places, lodging, lodgingOptions,
    warnings:[...new Set(warnings)], returnRoute, lodgingRoute, lodgingArrivalAt, day2StartAt, day1EndAt:lodgingArrivalAt, safetyBufferMin,
  };
}

async function buildWithValidatedLodgings(options, selected, title) {
  const candidates = options.lodgingCandidates || [];
  const variants = [];
  for (const lodging of candidates) {
    const plan = options.input.tripSpan === 'overnight'
      ? await buildOvernightPlan({ ...options, selected, title, lodging, lodgingOptions:[] })
      : await buildDayPlan({ ...options, selected, title, lodging, lodgingOptions:[] });
    if (!plan) continue;
    variants.push(plan);
    if (variants.length >= 5) break;
  }
  if (!variants.length) return null;

  const lodgingOptions = variants.map((variant) => variant.lodging);
  const snapshots = variants.map((variant) => ({
    ...variant,
    lodgingOptions,
    lodgingVariants:undefined,
  }));
  return {
    ...snapshots[0],
    lodgingOptions,
    lodgingVariants:snapshots,
  };
}

async function tryBuildWithTrim(options, minCount) {
  let selected = [...options.selected];
  let bestPlan = null;
  const lodgingTarget = Math.min(5, options.lodgingCandidates?.length || 0);
  while (selected.length >= minCount) {
    const title = strategyTitle(options.strategy, selected, options.input.tripSpan);
    const plan = options.input.accommodation
      ? await buildWithValidatedLodgings(options, selected, title)
      : await buildDayPlan({ ...options, selected, title, lodging:null, lodgingOptions:[] });
    if (plan) {
      if (!options.input.accommodation) return plan;
      if (!bestPlan || (plan.lodgingOptions?.length || 0) > (bestPlan.lodgingOptions?.length || 0)) bestPlan = plan;
      if ((plan.lodgingOptions?.length || 0) >= lodgingTarget) return plan;
    }
    if (selected.length === minCount) break;
    const lastFood = selected.map((item) => item.place.type).lastIndexOf('food');
    if (lastFood === selected.length - 1 && selected.length > minCount) selected.splice(selected.length - 2, 1);
    else selected.pop();
  }
  return bestPlan;
}

function ensureMealCount(selected, pool, count) {
  const next = [...selected];
  const used = new Set(next.map((item) => item.place.id));
  let current = next.filter((item) => item.place.type === 'food').length;
  for (const item of pool) {
    if (current >= count) break;
    if (item.place.type !== 'food' || used.has(item.place.id)) continue;
    next.push(item); used.add(item.place.id); current += 1;
  }
  return next;
}

function arrangeOvernightMeals(selected, pool, input, count = 2) {
  const targetLength = Math.max(4, selected.length);
  const merged = uniqById([...selected, ...pool]);
  const foods = merged.filter((item) => item.place.type === 'food').slice(0, count);
  const usedFood = new Set(foods.map((item) => item.place.id));
  const nonFoods = uniqById([
    ...selected.filter((item) => item.place.type !== 'food'),
    ...pool.filter((item) => item.place.type !== 'food' && !usedFood.has(item.place.id)),
  ]).slice(0, Math.max(0, targetLength - foods.length));
  const finalLength = nonFoods.length + foods.length;
  if (!foods.length || finalLength < 2) return [...nonFoods, ...foods];

  const cut = overnightSplitIndex(finalLength, input);
  const slots = new Array(finalLength).fill(null);
  const mealSlots = foods.length === 1
    ? [Math.max(0, cut - 1)]
    : [Math.max(0, cut - 1), Math.min(finalLength - 1, cut + Math.max(0, Math.floor((finalLength - cut - 1) / 2)))];
  foods.forEach((food, index) => {
    let slot = mealSlots[index] ?? finalLength - 1;
    while (slots[slot] && slot < finalLength - 1) slot += 1;
    while (slots[slot] && slot > 0) slot -= 1;
    slots[slot] = food;
  });
  let cursor = 0;
  for (let i = 0; i < slots.length; i += 1) {
    if (slots[i]) continue;
    slots[i] = nonFoods[cursor++] || null;
  }
  return slots.filter(Boolean);
}

function overlapRatio(a, b) {
  if (!a?.places?.length || !b?.places?.length) return 0;
  const aa = new Set(a.places.map((p) => p.place.id)), bb = new Set(b.places.map((p) => p.place.id));
  let common = 0; aa.forEach((id) => { if (bb.has(id)) common += 1; });
  return common / Math.max(aa.size, bb.size);
}

function routeDiagnostic(from, to, route, kind) {
  if (!route) return null;
  return {
    from:from?.title || from?.label || '출발지',
    to:to?.title || to?.label || '도착지',
    kind,
    mode:route.mode,
    requestedMode:route.requestedMode || route.mode,
    durationMin:route.durationMin || 0,
    distanceM:Number.isFinite(route.distanceM) ? route.distanceM : null,
    providerStatus:route.providerStatus || 'unknown',
    reason:route.fallbackReason || route.failureReason || null,
    walkFallbackReason:route.walkFallbackReason || null,
  };
}

function buildRouteDiagnostics(plan, input) {
  const diagnostics = [];
  const day1 = plan.places.filter((entry) => entry.day !== 2);
  const day2 = plan.places.filter((entry) => entry.day === 2);
  let current = input.origin;
  for (const entry of day1) {
    diagnostics.push(routeDiagnostic(current, entry.place, entry.travelFromPrevious, 'visit'));
    current = entry.place;
  }
  if (plan.lodging && plan.lodgingRoute) {
    diagnostics.push(routeDiagnostic(current, plan.lodging, plan.lodgingRoute, 'lodging'));
    current = plan.lodging;
  }
  for (const entry of day2) {
    diagnostics.push(routeDiagnostic(current, entry.place, entry.travelFromPrevious, 'visit'));
    current = entry.place;
  }
  if (plan.returnRoute) diagnostics.push(routeDiagnostic(current, input.origin, plan.returnRoute, 'return'));
  return diagnostics.filter(Boolean);
}

function withMeta(plans, meta) { plans.meta = meta; return plans; }

export async function generatePlans({ input:rawInput, placeProvider, routeProvider, config = {}, effectivePreference = null }) {
  const { valid, errors, input } = validatePlannerInput(rawInput);
  if (!valid) { const error = new Error(errors.join(' ')); error.code = 'INVALID_PLANNER_INPUT'; error.details = errors; throw error; }
  if (!placeProvider?.getNearbyPlaces || !routeProvider?.getRoute) throw new Error('Provider contract is incomplete.');

  const cfg = { ...DEFAULT_RECOMMENDATION_CONFIG, ...config };
  const cachedRoutes = routeProvider instanceof CachedRouteProvider ? routeProvider : new CachedRouteProvider(routeProvider);
  const requestedMealCount = input.tripSpan === 'overnight' ? 2 : (hasMealWindow(input.startAt, input.endAt) ? 1 : 0);
  const nearbyParams = { lat:input.origin.lat, lng:input.origin.lng, radius:cfg.candidateRadiusM, page:1 };
  const [generalPlaces, foodPlaces] = await Promise.all([
    placeProvider.getNearbyPlaces({ ...nearbyParams, size:input.tripSpan === 'overnight' ? Math.max(48,cfg.initialCandidateLimit) : cfg.initialCandidateLimit }),
    requestedMealCount > 0 && placeProvider.getFoodCandidates
      ? placeProvider.getFoodCandidates({ ...nearbyParams, size:12 })
      : Promise.resolve([]),
  ]);
  const discovered = uniqById([...(generalPlaces || []), ...(foodPlaces || [])]);
  const shortlistLimit = input.tripSpan === 'overnight' ? Math.max(14, cfg.routeShortlistLimit) : Math.max(10, cfg.routeShortlistLimit);
  const candidates = uniqById((discovered || [])
    .filter(hasValidCoordinates).filter((place) => place.openInfo?.status !== 'confirmed_closed').filter((place) => place.type !== 'lodging')
    .map((place) => ({ place, distanceM:haversineMeters(input.origin, place) })).filter((item) => Number.isFinite(item.distanceM))
    .sort((a,b)=>a.distanceM-b.distanceM).slice(0, shortlistLimit));

  const baseMeta = { discovered:discovered?.length || 0, candidates:candidates.length, routed:0, confirmedRoutes:0, estimatedRoutes:0, unavailableRoutes:0, fallbackRoutes:0, reason:null };
  if (!candidates.length) return withMeta([], { ...baseMeta, reason:'NO_CANDIDATES', routeStats:cachedRoutes.stats });

  const routedResults = await mapLimit(candidates, cfg.routeConcurrency, async (item) => ({ ...item, originRoute:await cachedRoutes.getRoute({ origin:input.origin, destination:item.place, mode:input.transport }) }));
  const routeValues = routedResults.filter((x)=>x.status === 'fulfilled').map((x)=>x.value);
  baseMeta.confirmedRoutes = routeValues.filter((x)=>x.originRoute?.providerStatus === 'confirmed').length;
  baseMeta.estimatedRoutes = routeValues.filter((x)=>x.originRoute?.providerStatus === 'estimated').length;
  baseMeta.fallbackRoutes = routeValues.filter((x)=>x.originRoute?.fallbackReason).length;
  baseMeta.unavailableRoutes = routeValues.filter((x)=>x.originRoute?.providerStatus === 'unavailable').length + routedResults.filter((x)=>x.status === 'rejected').length;
  const routed = routeValues.filter((item) => item.originRoute?.providerStatus !== 'unavailable' && item.originRoute?.durationMin <= cfg.maxOutboundMin);
  baseMeta.routed = routed.length;
  if (routed.length < 2) return withMeta([], { ...baseMeta, reason:'ROUTE_UNAVAILABLE', routeStats:cachedRoutes.stats });

  const ranked = selectBaseCandidates(routed, input, effectivePreference);
  const lodgingNeeded = input.tripSpan === 'overnight' || input.accommodation;
  const lodgingCandidates = lodgingNeeded ? await placeProvider.getLodgingCandidates({ lat:input.origin.lat, lng:input.origin.lng, radius:cfg.candidateRadiusM, page:1, size:12 }) : [];
  const lodgingPool = uniqById((lodgingCandidates || []).filter((place) => hasValidCoordinates(place) && place.openInfo?.status !== 'confirmed_closed'));
  if (lodgingNeeded && !lodgingPool.length) return withMeta([], { ...baseMeta, reason:'NO_LODGING', routeStats:cachedRoutes.stats });

  const mealCount = requestedMealCount;
  const strategies = buildPersonalizedStrategies(effectivePreference, input);
  const micro = minutesBetween(input.startAt, input.endAt) < 180;
  const builtPlans = [];
  const usedIds = new Set();
  const rng = createRng(cfg.seed);

  for (const strategy of strategies) {
    const strategyPreference = preferenceForStrategy(effectivePreference, strategy);
    let strategyRanked = selectBaseCandidates(routed, input, strategyPreference);

    if (strategy.id === 'discovery') {
      const preferredFresh = strategyRanked.filter((item) => !usedIds.has(item.place.id));
      const familiar = strategyRanked.filter((item) => usedIds.has(item.place.id));
      const freshPool = shuffle(preferredFresh.slice(0, Math.max(8, preferredFresh.length)), rng);
      strategyRanked = [...freshPool, ...familiar, ...strategyRanked.filter((item)=>!preferredFresh.includes(item) && !familiar.includes(item))];
    }

    const target = personalizedTargetCount({ tripSpan:input.tripSpan, preference:effectivePreference, strategy, micro });
    let selected = strategyRanked.slice(0, Math.min(target, strategyRanked.length));
    selected = input.tripSpan === 'overnight'
      ? arrangeOvernightMeals(selected, strategyRanked, input, mealCount)
      : uniqById(ensureMealCount(selected, strategyRanked, mealCount));

    const legacyBaseBuffer = strategy.legacyType === 'slow'
      ? cfg.slowSafetyBufferMin
      : strategy.legacyType === 'full' ? cfg.fullSafetyBufferMin : cfg.randomSafetyBufferMin;
    const safetyBufferMin = strategySafetyBuffer(legacyBaseBuffer, effectivePreference, strategy);
    const minCount = input.tripSpan === 'overnight' ? 3 : 2;
    let plan = await tryBuildWithTrim({
      type:strategy.legacyType,
      strategy,
      effectivePreference,
      theme:strategy.label,
      selected,
      input,
      routeProvider:cachedRoutes,
      safetyBufferMin,
      lodgingCandidates:lodgingPool,
    }, minCount);

    if (plan && strategy.id !== 'signature' && builtPlans.some((other)=>overlapRatio(plan, other) > .82)) {
      const alternatives = strategyRanked.filter((item)=>!builtPlans.some((other)=>other.places.some((p)=>p.place.id === item.place.id)));
      if (alternatives.length >= minCount) {
        const candidateSlice = strategy.id === 'discovery'
          ? shuffle(alternatives, rng).slice(0, target)
          : uniqById([
              ...strategyRanked.slice(0, Math.max(1, Math.floor(target * 0.4))),
              ...alternatives,
            ]).slice(0, target);
        const alternativeSelected = input.tripSpan === 'overnight'
          ? arrangeOvernightMeals(candidateSlice, strategyRanked, input, mealCount)
          : uniqById(ensureMealCount(candidateSlice, strategyRanked, mealCount));
        plan = await tryBuildWithTrim({
          type:strategy.legacyType,
          strategy,
          effectivePreference,
          theme:strategy.label,
          selected:alternativeSelected,
          input,
          routeProvider:cachedRoutes,
          safetyBufferMin,
          lodgingCandidates:lodgingPool,
        }, minCount) || plan;
      }
    }

    if (plan) {
      plan.recommendationReason = personalizationReason(effectivePreference, input, strategy);
      plan.personalizationSource = effectivePreference?.source || 'neutral';
      builtPlans.push(plan);
      for (const entry of plan.places || []) usedIds.add(entry.place.id);
    }
  }

  const plans = builtPlans.filter((plan)=>plan.returnAt <= input.endAt);
  plans.forEach((plan) => {
    plan.routeDiagnostics = buildRouteDiagnostics(plan, input);
    if (Array.isArray(plan.lodgingVariants)) {
      plan.lodgingVariants = plan.lodgingVariants.map((variant) => ({
        ...variant,
        lodgingOptions:plan.lodgingOptions,
        routeDiagnostics:buildRouteDiagnostics(variant, input),
      }));
    }
  });
  const finalRoutes = plans.flatMap((plan) => plan.routeDiagnostics || []);
  const walkingRoutes = finalRoutes.filter((item) => item.mode === 'walk' && item.requestedMode === 'transit');
  const estimatedFinalRoutes = finalRoutes.filter((item) => item.providerStatus === 'estimated');
  const fallbackDetails = estimatedFinalRoutes.filter((item) => item.reason).map((item) => ({ from:item.from, to:item.to, reason:item.reason }));
  return withMeta(plans, {
    ...baseMeta,
    reason:plans.length ? null : 'WINDOW_TOO_SHORT',
    routeStats:cachedRoutes.stats,
    walkingRoutes:walkingRoutes.length,
    estimatedFinalRoutes:estimatedFinalRoutes.length,
    fallbackDetails,
    lodgingOptions:plans.length ? Math.max(...plans.map((plan) => plan.lodgingOptions?.length || 0)) : 0,
  });
}
