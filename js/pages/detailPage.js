import { getRuntimeKeys } from '../features/planner/runtimeConfig.js';
import { renderPlanMap } from '../api/kakaoMap.js';
import { getTrip, saveTrip } from '../core/tripStorage.js';
import { currentTripOwnerId, ALLOW_GUEST_TRIP_SAVE } from '../integration/tripAuthBridge.js';
import { buildTimeline } from '../features/timeline/buildTimeline.js';
import { formatDuration, formatTime, formatDateTime } from '../features/recommendation/time.js';
import { loadActivePlan, loadPlannerInput, loadPlans, revivePlan, saveActivePlan } from '../features/planner/plannerState.js';
import { normalizePlannerInput } from '../features/planner/validation.js';

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const legacyPlanLabels = { slow: '🌿 여유로운 틈', full: '⚡ 빽빽한 틈', random: '🎲 랜덤 컨셉 틈' };
const planLabel = (plan) => plan?.strategyLabel ? `${plan.strategyIcon || '✦'} ${plan.strategyLabel}` : (legacyPlanLabels[plan?.type] || '맞춤 여행');
let currentPlan = null;
let currentInput = null;
let currentKeys = null;

function getContext() {
  const params = new URLSearchParams(location.search);
  const tripId = params.get('trip');
  if (tripId) {
    const trip = getTrip(tripId);
    if (trip) return { plan: revivePlan(trip.plan), input: normalizePlannerInput(trip.plannerInput) };
  }
  const planType = params.get('plan');
  const plans = loadPlans();
  const active = loadActivePlan();
  const plan = (active?.type === planType ? active : null) || plans.find((item) => item.type === planType) || active || plans[0] || null;
  return { plan, input: loadPlannerInput() };
}

function totalDistance(plan) {
  const routes = [...plan.places.map((p) => p.travelFromPrevious), plan.returnRoute, plan.lodgingRoute].filter(Boolean);
  const values = routes.map((r) => r.distanceM).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}

function renderTimeline(plan, input) {
  const items = buildTimeline(plan, input);
  document.querySelector('#timelineList').innerHTML = items.map((item) => item.divider
    ? `<div class="timeline-day-divider"><span>${esc(item.time)}</span><strong>${esc(item.title)}</strong><small>${esc(item.description)}</small></div>`
    : `<div class="timeline-item"><div class="timeline-time">${esc(item.time)}</div><div class="timeline-place"><strong>${esc(item.title)}</strong><span>${esc(item.description)}</span><span class="leg">${esc(item.kind)}</span></div></div>`).join('');
}

function renderPlaces(plan) {
  const places = [...plan.places.map((entry) => entry.place), ...(plan.lodging ? [plan.lodging] : [])];
  const labels = { attraction:'관광지', food:'음식점', lodging:'숙박', culture:'문화', event:'행사', course:'코스', shopping:'쇼핑', unknown:'장소' };
  document.querySelector('#placeGrid').innerHTML = places.map((place) => `<article class="place-card"><span class="place-badge">${esc(labels[place.type] || '장소')}</span><h3>${esc(place.title)}</h3><p>${esc(place.address || place.overview || '상세 정보 확인 필요')}</p>${place.openInfo?.status === 'unknown' ? '<p>운영시간 확인 필요</p>' : ''}</article>`).join('');
}

function kakaoMapLink(place) {
  return `https://map.kakao.com/link/map/${encodeURIComponent(place.title || '장소')},${place.lat},${place.lng}`;
}

function lodgingVariants(plan) {
  const variants = Array.isArray(plan.lodgingVariants) ? plan.lodgingVariants : [];
  if (variants.length) return variants.slice(0, 5);
  return plan.lodging ? [plan] : [];
}

function renderLodgingOptions(plan) {
  const section = document.querySelector('#lodgingSection');
  const grid = document.querySelector('#lodgingGrid');
  const copy = document.querySelector('#lodgingSectionCopy');
  const variants = lodgingVariants(plan);
  if (!section || !grid || !variants.length) {
    if (section) section.hidden = true;
    return;
  }
  section.hidden = false;
  if (copy) copy.textContent = `아래 ${variants.length}곳은 모두 현재 코스에 실제 대입해 Day 1 체크인 → Day 2 출발 → 최종 귀가시간 검증을 통과한 숙소입니다.`;
  grid.innerHTML = variants.map((variant, index) => {
    const place = variant.lodging;
    const active = place?.id === plan.lodging?.id;
    const openText = place?.openInfo?.text || (place?.openInfo?.status === 'unknown' ? '운영시간 확인 필요' : '운영정보 확인 필요');
    const arrival = variant.lodgingArrivalAt ? formatTime(variant.lodgingArrivalAt) : '확인 필요';
    const day2First = (variant.places || []).find((entry) => entry.day === 2);
    const day2Travel = day2First?.travelFromPrevious?.durationMin;
    return `<article class="lodging-card ${active ? 'active' : ''}" data-lodging-id="${esc(place?.id)}">
      <img loading="lazy" src="${esc(place?.imageUrl || 'assets/images/hero.svg')}" alt="${esc(place?.title)}">
      <div class="lodging-card-body"><span class="lodging-badge">${active ? '현재 일정 숙소' : '일정 반영 숙소'}</span><h3>${esc(place?.title)}</h3><p>${esc(place?.address || '주소 확인 필요')}</p><p>${esc(openText)}</p><p>Day 1 ${esc(arrival)} 체크인${Number.isFinite(day2Travel) ? ` · Day 2 첫 이동 ${day2Travel}분` : ''}</p><div class="lodging-actions"><button type="button" class="lodging-select-button" data-select-lodging="${esc(place?.id)}" ${active ? 'disabled' : ''}>${active ? '선택됨' : '이 숙소로 일정 보기'}</button><a class="lodging-map-link" href="${kakaoMapLink(place)}" target="_blank" rel="noopener">지도에서 보기 →</a></div></div>
    </article>`;
  }).join('');
  grid.querySelectorAll('[data-select-lodging]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.selectLodging;
      const sourceVariants = lodgingVariants(currentPlan);
      const selected = sourceVariants.find((variant) => variant.lodging?.id === id);
      if (!selected) return;
      currentPlan = revivePlan({
        ...selected,
        lodgingOptions:sourceVariants.map((variant) => variant.lodging),
        lodgingVariants:sourceVariants,
      });
      saveActivePlan(currentPlan);
      await renderAll();
      showSaveFeedback(`${currentPlan.lodging?.title || '숙소'} 기준 일정으로 바꿨습니다.`);
      section.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });
}

function routeReasonCopy(reason) {
  if (!reason) return '상세 원인 없음';
  if (reason.includes('NO_RESULTS')) return '대중교통 경로 없음(NO_RESULTS)';
  if (reason.includes('STARTNODES_NULL')) return '출발지 주변 대중교통 노드 없음';
  if (reason.includes('ENDNODES_NULL')) return '도착지 주변 대중교통 노드 없음';
  if (reason.includes('EQUAL_POINTS')) return '출발·도착 좌표가 동일하거나 매우 가까움';
  if (reason.includes('HTTP_403') || reason.includes('NotAuthorizedError')) return 'Kakao API 권한/서비스 설정 응답(403)';
  if (reason.includes('HTTP_429')) return 'Kakao API 쿼터/호출 제한(429)';
  if (reason.includes('WALK_ENDPOINT_UNAVAILABLE') || reason.includes('HTTP_404')) return 'Kakao 도보 경로 엔드포인트가 현재 환경에서 응답하지 않음';
  return reason;
}

function renderRouteDiagnostics(plan) {
  const section = document.querySelector('#routeDiagnosticSection');
  const grid = document.querySelector('#routeDiagnosticGrid');
  if (!section || !grid) return;
  const diagnostics = (plan.routeDiagnostics || []).filter((item) => item.providerStatus === 'estimated' || (item.mode === 'walk' && item.requestedMode === 'transit'));
  if (!diagnostics.length) {
    section.hidden = true;
    grid.innerHTML = '';
    return;
  }
  section.hidden = false;
  grid.innerHTML = diagnostics.map((item) => {
    const walk = item.mode === 'walk' && item.requestedMode === 'transit';
    const state = walk ? '도보 전환' : '거리 기반 예상값';
    return `<article class="route-diagnostic-card ${walk ? 'walk' : 'estimated'}"><span class="route-state">${state}</span><strong>${esc(item.from)} → ${esc(item.to)}</strong><span>${item.durationMin || '-'}분${Number.isFinite(item.distanceM) ? ` · ${(item.distanceM / 1000).toFixed(1)}km` : ''}</span><small>${esc(routeReasonCopy(item.reason))}${item.walkFallbackReason ? ` · 도보 재시도: ${esc(routeReasonCopy(item.walkFallbackReason))}` : ''}</small></article>`;
  }).join('');
}

function renderSummary(plan, input) {
  const first = plan.places[0]?.place;
  document.title = `${plan.title} — 틈`;
  document.querySelector('#detailImage').src = first?.imageUrl || 'assets/images/hero.svg';
  document.querySelector('#detailImage').alt = `${plan.areaLabel} 여행 이미지`;
  document.querySelector('#detailBadge').textContent = planLabel(plan);
  document.querySelector('#detailKicker').textContent = `${plan.strategyTag || 'PERSONALIZED PLAN'}${plan.strategyLabel ? ` / ${plan.strategyLabel}` : (plan.theme ? ` / ${plan.theme}` : '')}`;
  document.querySelector('#detailTitle').textContent = plan.title;
  document.querySelector('#detailArea').textContent = first?.categoryPath || plan.areaLabel;
  const overnight = plan.tripSpan === 'overnight' || input?.tripSpan === 'overnight';
  document.querySelector('#detailTime').textContent = overnight ? `${formatDateTime(plan.startAt)} → ${formatDateTime(plan.returnAt)}` : `${formatTime(plan.startAt)} → ${formatTime(plan.returnAt)}`;
  document.querySelector('#detailDuration').textContent = overnight ? `1박2일 · 활동 ${formatDuration(plan.activeDurationMin)}` : formatDuration(plan.totalDurationMin);
  document.querySelector('#detailPlaceCount').textContent = `${plan.places.length}${plan.lodging ? ' + 숙박' : ''}곳`;
  document.querySelector('#detailTravel').textContent = formatDuration(plan.totalTravelMin);
  document.querySelector('#timelineDuration').textContent = overnight ? `1박2일 · 이동 ${formatDuration(plan.totalTravelMin)}` : `총 ${formatDuration(plan.totalDurationMin)}`;
  const distance = totalDistance(plan);
  if (input?.transport === 'car') {
    document.querySelector('#detailCostLabel').textContent = '이동 거리';
    document.querySelector('#detailCost').textContent = Number.isFinite(distance) ? `${(distance / 1000).toFixed(1)} km` : '확인 필요';
  } else {
    document.querySelector('#detailCostLabel').textContent = '예상 교통비';
    document.querySelector('#detailCost').textContent = Number.isFinite(plan.transportCost) ? `₩${plan.transportCost.toLocaleString('ko-KR')}` : '확인 필요';
  }
  document.querySelector('#detailReturnNote').textContent = overnight ? 'Day 1 숙소 체크인과 Day 2 최종 귀가시간까지 검증된 1박2일 일정입니다.' : (input?.accommodation ? '귀가 대신 숙소 체크인 시각까지 검증된 일정입니다.' : '귀가 시간까지 포함해 검증된 일정입니다.');
  document.querySelector('#detailWarnings').innerHTML = (plan.warnings || []).map((warning) => `<li>${esc(warning)}</li>`).join('');
}

function showSaveFeedback(message) {
  const feedback = document.querySelector('#saveFeedback');
  feedback.textContent = message;
  feedback.classList.add('active');
  setTimeout(() => feedback.classList.remove('active'), 1500);
}

function saveCurrent(event) {
  event?.preventDefault();
  if (!currentPlan || !currentInput) return;
  const ownerUserId = currentTripOwnerId();
  if (!ownerUserId && !ALLOW_GUEST_TRIP_SAVE) {
    showSaveFeedback('여행을 저장하려면 로그인이 필요합니다.');
    setTimeout(() => { location.href = 'login.html?next=mypage'; }, 500);
    return;
  }
  saveTrip({ plannerInput: currentInput, plan: currentPlan, ownerUserId });
  showSaveFeedback(ownerUserId ? '내 계정에 이 일정을 저장했습니다.' : '이 브라우저에 게스트 일정으로 저장했습니다.');
}

async function renderMap(plan) {
  const map = document.querySelector('#planMap');
  if (!map) return;
  map.dataset.mapState = 'loading';
  map.innerHTML = '';
  const rendered = await renderPlanMap(map, plan, { javaScriptKey: currentKeys?.kakaoJavaScriptKey });
  if (rendered.status !== 'confirmed') {
    map.dataset.mapState = 'unavailable';
    const note = document.createElement('div');
    note.className = 'map-fallback-note';
    const reason = rendered.error?.message || '';
    note.textContent = reason === 'KAKAO_JS_KEY_MISSING'
      ? 'Kakao JavaScript 키가 없어 지도를 표시하지 못했습니다. 장소 좌표와 일정은 정상적으로 유지됩니다.'
      : 'Kakao 지도를 불러오지 못했습니다. JavaScript 키·등록 도메인·네트워크 상태를 확인해 주세요. 일정 데이터는 정상적으로 유지됩니다.';
    map.appendChild(note);
  } else {
    map.dataset.mapState = 'confirmed';
  }
}

async function renderAll() {
  renderSummary(currentPlan, currentInput);
  renderTimeline(currentPlan, currentInput);
  renderPlaces(currentPlan);
  renderLodgingOptions(currentPlan);
  renderRouteDiagnostics(currentPlan);
  await renderMap(currentPlan);
}

async function init() {
  const context = getContext();
  currentPlan = context.plan;
  currentInput = context.input;
  if (!currentPlan) {
    document.querySelector('#detailTitle').textContent = '불러올 여행 일정이 없습니다.';
    document.querySelector('#detailArea').textContent = '추천 결과에서 일정을 선택해 주세요.';
    return;
  }
  currentKeys = await getRuntimeKeys();
  document.querySelector('#saveTripDesktop')?.addEventListener('click', saveCurrent);
  document.querySelector('#saveTripMobile')?.addEventListener('click', saveCurrent);
  await renderAll();
}

init();
