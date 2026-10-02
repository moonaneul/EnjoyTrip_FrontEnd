import { getRuntimeKeys } from '../features/planner/runtimeConfig.js';
import { createRouteProvider } from '../api/kakaoRoute.js';
import { placeProvider } from '../integration/placeProvider.js';
import { getCurrentUser } from '../core/authStorage.js';
import { getUserPreference } from '../features/preferences/preferenceStorage.js';
import { resolvePreference } from '../features/preferences/preferenceResolver.js';
import { generatePlans } from '../features/recommendation/generatePlans.js';
import { formatDuration, formatTime, formatDateTime, minutesBetween } from '../features/recommendation/time.js';
import { loadPlannerInput, saveActivePlan, savePlans } from '../features/planner/plannerState.js';

const grid = document.querySelector('#resultGrid');
const status = document.querySelector('#resultStatus');
const empty = document.querySelector('#resultEmpty');
const headline = document.querySelector('#resultHeadline');
const toolbar = document.querySelector('#resultToolbar');
const meta = document.querySelector('#resultMeta');
const indicator = document.querySelector('#resultIndicator');
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const legacyPlanLabels = { slow:'🌿 여유로운 틈', full:'⚡ 빽빽한 틈', random:'🎲 랜덤 컨셉 틈' };
const planLabel = (plan) => plan?.strategyLabel ? `${plan.strategyIcon || '✦'} ${plan.strategyLabel}` : (legacyPlanLabels[plan?.type] || '맞춤 여행');
const planTag = (plan) => plan?.strategyTag || (plan?.theme ? String(plan.theme).toUpperCase() : 'PERSONALIZED');

function routeDistance(plan) {
  const routes = [...plan.places.map((p)=>p.travelFromPrevious), plan.returnRoute, plan.lodgingRoute].filter(Boolean);
  const values = routes.map((r)=>r.distanceM).filter(Number.isFinite);
  return values.length ? values.reduce((a,b)=>a+b,0) : null;
}

function tripLabel(input) {
  return input.tripSpan === 'overnight' ? '1박2일' : formatDuration(minutesBetween(input.startAt, input.endAt));
}

function renderToolbar(input) {
  const overnight = input.tripSpan === 'overnight';
  toolbar.innerHTML = `
    <span class="summary-chip">${esc(input.origin.label)}</span>
    <span class="summary-chip">${overnight ? `${formatDateTime(input.startAt)} → ${formatDateTime(input.endAt)}` : `${formatTime(input.startAt)}—${formatTime(input.endAt)}`}</span>
    <span class="summary-chip">${overnight ? '1박2일' : '당일'}</span>
    <span class="summary-chip">${input.transport === 'car' ? '자차' : '대중교통'}</span>
    <span class="summary-chip">${input.accommodation ? (overnight ? '숙박 필수' : '숙박 추천') : '숙박 없음'}</span>
    <div class="time-band" aria-label="사용 가능 시간 요약"><div class="time-band-head"><span>${overnight ? 'DAY 1' : formatTime(input.startAt)}</span><strong>${tripLabel(input)}의 틈</strong><span>${overnight ? 'DAY 2' : formatTime(input.endAt)}</span></div><div class="time-band-line"><div class="time-band-fill" style="width:100%"></div></div></div>`;
}

function card(plan, input) {
  const first = plan.places[0]?.place;
  const image = first?.imageUrl || 'assets/images/hero.svg';
  const day1 = plan.places.filter((entry)=>entry.day !== 2).map((entry)=>entry.place.title);
  const day2 = plan.places.filter((entry)=>entry.day === 2).map((entry)=>entry.place.title);
  const titles = input.tripSpan === 'overnight'
    ? [`DAY 1 ${day1.join(' → ')}`, plan.lodging?.title ? `숙박 ${plan.lodging.title}` : '', `DAY 2 ${day2.join(' → ')}`].filter(Boolean)
    : plan.places.map((entry)=>entry.place.title).concat(plan.lodging ? [plan.lodging.title] : []);
  const distance = routeDistance(plan);
  const secondFact = input.transport === 'transit'
    ? (Number.isFinite(plan.transportCost) ? `교통 ₩${plan.transportCost.toLocaleString('ko-KR')}` : '교통비 확인 필요')
    : (Number.isFinite(distance) ? `이동 ${(distance/1000).toFixed(1)}km` : '거리 확인 필요');
  const routes = [...plan.places.map((p)=>p.travelFromPrevious), plan.returnRoute, plan.lodgingRoute].filter(Boolean);
  const diagnostics = plan.routeDiagnostics || [];
  const estimated = diagnostics.some((r)=>r?.providerStatus === 'estimated') || routes.some((r)=>r?.providerStatus === 'estimated');
  const walking = diagnostics.some((r)=>r?.mode === 'walk' && r?.requestedMode === 'transit');
  const fallback = diagnostics.some((r)=>r?.providerStatus === 'estimated' && r?.reason) || routes.some((r)=>r?.fallbackReason && r?.providerStatus === 'estimated');
  const endLabel = input.tripSpan === 'overnight' ? formatDateTime(plan.returnAt) : formatTime(plan.returnAt);
  const startLabel = input.tripSpan === 'overnight' ? formatDateTime(plan.startAt) : formatTime(plan.startAt);
  const durationFact = input.tripSpan === 'overnight' ? `1박2일 · 활동 ${formatDuration(plan.activeDurationMin)}` : formatDuration(plan.totalDurationMin);
  return `<article class="postcard" data-plan="${esc(plan.type)}">
    <a class="postcard-link" href="detail.html?plan=${encodeURIComponent(plan.type)}" data-open-plan="${esc(plan.type)}" aria-label="${esc(plan.title)} 일정 자세히 보기">
      <div class="postcard-photo"><img loading="lazy" src="${esc(image)}" alt="${esc(plan.areaLabel)} 여행 이미지"><span class="plan-badge">${esc(planLabel(plan))}</span><span class="postmark" aria-hidden="true"></span></div>
      <div class="postcard-body"><div class="postcard-topline"><p class="postcard-label">Today's teum</p><span class="theme-tag">${esc(planTag(plan))}</span></div>
      <h3 class="postcard-title">${esc(plan.title)}</h3><div class="postcard-area">${esc(first?.categoryPath || plan.areaLabel)}</div><div class="paper-rule"></div>
      <div class="time-row"><div class="time-block"><span class="time-label">${input.tripSpan === 'overnight' ? 'Day 1 Start' : 'Start'}</span><span class="time-value time-value-compact">${esc(startLabel)}</span></div><div class="time-arrow"><span>→</span></div><div class="time-block"><span class="time-label">${input.tripSpan === 'overnight' ? 'Day 2 Return' : (input.accommodation ? 'Check-in' : 'Return')}</span><span class="time-value time-value-compact">${esc(endLabel)}</span></div></div>
      <div class="fact-row"><span class="fact">${esc(durationFact)}</span><span class="fact">${esc(secondFact)}</span></div>
      <div class="route-title">COURSE PREVIEW</div><p class="route-preview route-preview-multiday">${esc(titles.join(' / '))}</p>
      ${plan.recommendationReason ? `<span class="personalization-note">${esc(plan.recommendationReason)}</span>` : ''}
      <span class="provider-note">${walking ? '가까운 구간 · Kakao 도보 전환' : estimated ? (fallback ? 'Kakao 실패 구간 · 예상값 fallback' : '이동시간 · 예상값') : 'Kakao 경로 · 확인값'}</span>
      ${(plan.lodgingOptions || []).length ? `<span class="lodging-count">일정 반영 숙소 ${(plan.lodgingOptions || []).length}곳 · 상세에서 선택</span>` : ''}
      <div class="postcard-foot"><span>장소 ${plan.places.length}${plan.lodging ? ' + 숙박' : ''} · 이동 ${formatDuration(plan.totalTravelMin)}</span><span class="card-cta">일정 보기 →</span></div></div></a></article>`;
}

function setupIndicator() {
  const cards = [...grid.querySelectorAll('.postcard')];
  indicator.innerHTML = cards.map((_,i)=>`<span class="dot ${i===0?'active':''}"></span>`).join('');
  const dots = [...indicator.querySelectorAll('.dot')];
  const update = () => {
    if (window.innerWidth > 767 || !cards.length) return;
    const left = grid.getBoundingClientRect().left; let closest=0, distance=Infinity;
    cards.forEach((card,i)=>{ const d=Math.abs(card.getBoundingClientRect().left-left-20); if(d<distance){distance=d;closest=i;} });
    dots.forEach((dot,i)=>dot.classList.toggle('active',i===closest));
  };
  grid.addEventListener('scroll', update, { passive:true }); update();
}

function failureCopy(reason) {
  const map = {
    NO_CANDIDATES:['현재 위치 주변의 장소 후보가 없어요.','출발지를 바꾸거나 통합 단계에서 실제 TourAPI Provider를 연결해 주세요.'],
    ROUTE_UNAVAILABLE:['이동 가능한 후보를 충분히 확인하지 못했어요.','경로 API가 실패해도 예상 경로로 fallback하도록 설정되어 있습니다. 좌표와 후보 데이터를 확인해 주세요.'],
    NO_LODGING:['1박2일에 사용할 숙소 후보가 없어요.','출발지 주변 숙소 데이터가 필요합니다.'],
    WINDOW_TOO_SHORT:['선택한 시간 안에 완성할 수 있는 일정이 없어요.','귀가 시간을 늦추거나 더 가까운 출발지를 선택해 주세요.'],
  };
  return map[reason] || ['조건 안에서 만들 수 있는 일정이 없어요.','출발 위치와 시간을 바꿔 다시 찾아보세요.'];
}

async function init() {
  const input = loadPlannerInput();
  if (!input) { status.dataset.state='error'; status.textContent='여행 조건이 없습니다. 홈에서 먼저 조건을 입력해 주세요.'; empty.classList.add('active'); return; }
  renderToolbar(input);
  document.querySelector('#resultKicker').textContent = `Result / ${tripLabel(input)}`;
  try {
    const keys = await getRuntimeKeys();
    const routeProvider = createRouteProvider({ restApiKey:keys.kakaoRestApiKey, apiProxyBaseUrl:keys.kakaoApiProxyBaseUrl, hasKakaoRestApiKey:keys.hasKakaoRestApiKey, allowEstimatedWithoutKey:true });
    const currentUser = getCurrentUser();
    const storedPreference = currentUser ? getUserPreference(currentUser.id) : null;
    const effectivePreference = resolvePreference({ userPreference:storedPreference, tripContext:input });
    const plans = await generatePlans({ input, placeProvider, routeProvider, effectivePreference });
    const stats = plans.meta || {};
    savePlans(plans);
    if (!plans.length) {
      const [title, body] = failureCopy(stats.reason);
      headline.textContent = title; status.dataset.state='error'; status.textContent=body;
      empty.classList.add('active');
      empty.querySelector('h2').textContent = title; empty.querySelector('p').textContent = body;
      meta.textContent = `진단: ${stats.reason || 'UNKNOWN'} · 발견 ${stats.discovered ?? 0} · 후보 ${stats.candidates ?? 0} · 경로통과 ${stats.routed ?? 0} · 확정 ${stats.confirmedRoutes ?? 0} / 예상 ${stats.estimatedRoutes ?? 0} / 실패 ${stats.unavailableRoutes ?? 0}`;
      return;
    }
    headline.innerHTML = effectivePreference?.source === 'user'
      ? `${tripLabel(input)} 안에서<br>취향에 맞춘 ${plans.length}가지 여행을 만들었어요.`
      : `${tripLabel(input)} 안에 가능한<br>${plans.length}개의 여행을 찾았어요.`;
    grid.innerHTML = plans.map((plan)=>card(plan,input)).join(''); status.hidden=true;
    const detailReasons = (stats.fallbackDetails || []).slice(0, 3).map((item)=>`${item.from}→${item.to}: ${item.reason}`).join(' · ');
    const providerNote = stats.estimatedFinalRoutes > 0
      ? `최종 일정 예상값 ${stats.estimatedFinalRoutes}개 구간${detailReasons ? ` (${detailReasons})` : ''}.`
      : ((keys.kakaoRestApiKey || keys.hasKakaoRestApiKey) ? 'Kakao 공식 경로 우선 사용.' : 'API 키 미설정: 거리 기반 예상 경로 사용.');
    const walkNote = stats.walkingRoutes > 0 ? ` 대중교통 미제공 근거리 ${stats.walkingRoutes}개 구간은 Kakao 도보 경로로 전환.` : '';
    const lodgingNote = stats.lodgingOptions > 0 ? ` 일정 검증 숙소 최대 ${stats.lodgingOptions}곳.` : '';
    meta.textContent = `후보 ${stats.discovered ?? '-'}개 → shortlist ${stats.candidates ?? '-'}개 → 경로 통과 ${stats.routed ?? '-'}개 · 확정 ${stats.confirmedRoutes ?? 0} / 예상 ${stats.estimatedRoutes ?? 0} · Route 요청 ${stats.routeStats?.requests ?? '-'}회 / cache hit ${stats.routeStats?.hits ?? '-'}회. ${providerNote}${walkNote}${lodgingNote}`;
    grid.querySelectorAll('[data-open-plan]').forEach((link)=>link.addEventListener('click',()=>{ const plan=plans.find((item)=>item.type===link.dataset.openPlan); if(plan) saveActivePlan(plan); }));
    setupIndicator();
  } catch (error) {
    console.error(error);
    const tourKeyMissing = error?.name === 'TourApiConfigError' || String(error?.message || '').includes('TourAPI 키가 없습니다');
    status.dataset.state='error';
    status.textContent = tourKeyMissing
      ? 'TourAPI 키가 없어 실제 관광지 추천을 불러오지 못했습니다. 통합 키 설정 후 다시 시도해 주세요.'
      : (error?.details?.join(' ') || error.message || '추천 생성 중 오류가 발생했습니다.');
    empty.classList.add('active');
    if (tourKeyMissing) {
      empty.querySelector('h2').textContent = 'TourAPI 설정이 필요해요.';
      empty.querySelector('p').textContent = 'scripts/setup-integrated-keys.ps1로 공공데이터포털 Decoding key를 설정해 주세요.';
    }
  }
}

init();
