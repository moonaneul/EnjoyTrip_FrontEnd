import { getCurrentOrigin } from '../core/geolocation.js';
import { getRuntimeKeys } from '../features/planner/runtimeConfig.js';
import { geocodeAddress, reverseGeocodeCoordinates, searchPlaceKeyword } from '../api/kakaoMap.js';
import { buildTodayTime, buildTripEndTime } from '../features/recommendation/time.js';
import { validatePlannerInput } from '../features/planner/validation.js';
import { savePlannerInput } from '../features/planner/plannerState.js';
import { QUICK_ORIGINS, findQuickOrigin, toOrigin } from '../features/planner/locationCatalog.js';
import { getCurrentUser } from '../core/authStorage.js';
import { hasCompletedPreference } from '../features/preferences/preferenceStorage.js';

const form = document.querySelector('#plannerForm');
const originLabel = document.querySelector('#originLabel');
const originField = document.querySelector('#originField');
const originPicker = document.querySelector('#originPicker');
const status = document.querySelector('#plannerStatus');
const stayToggle = document.querySelector('#stayToggle');
const stayToggleText = document.querySelector('#stayToggleText');
const stayLabel = document.querySelector('#stayLabel');
const submit = document.querySelector('#plannerSubmit');
const returnFieldLabel = document.querySelector('#returnFieldLabel');
let origin = null;

function setStatus(message = '', state = '') {
  status.textContent = message;
  status.dataset.state = state;
}

function openPicker(message = '') {
  originPicker.classList.add('active');
  originPicker.setAttribute('aria-hidden', 'false');
  if (message) setStatus(message);
}

function closePicker() {
  originPicker.classList.remove('active');
  originPicker.setAttribute('aria-hidden', 'true');
}

function setOrigin(next) {
  origin = next;
  originLabel.textContent = next?.label || '출발지 선택';
  originLabel.title = next?.address || next?.label || '';
  closePicker();
  setStatus(next ? `${next.label}에서 출발하도록 설정했습니다.` : '', next ? 'success' : '');
}

async function locate() {
  setStatus('현재 위치를 확인하고 있어요.');
  try {
    const next = await getCurrentOrigin();
    const keys = await getRuntimeKeys();
    const resolved = await reverseGeocodeCoordinates(next, {
      restApiKey: keys.kakaoRestApiKey,
      apiProxyBaseUrl: keys.kakaoApiProxyBaseUrl,
      hasKakaoRestApiKey: keys.hasKakaoRestApiKey,
    });
    const namedOrigin = resolved
      ? { ...next, label: resolved.label, address: resolved.address, roadAddress: resolved.roadAddress }
      : { ...next, label: `위치 ${next.lat.toFixed(4)}, ${next.lng.toFixed(4)}` };
    setOrigin(namedOrigin);
    return namedOrigin;
  } catch (error) {
    openPicker(error.message);
    setStatus(`${error.message} 빠른 위치 또는 좌표 입력을 사용할 수 있습니다.`, 'error');
    return null;
  }
}

function activeTripSpan() {
  return document.querySelector('[data-segment="trip-span"].active')?.dataset.value === 'overnight' ? 'overnight' : 'day';
}

function updateTripSpanUI() {
  const overnight = activeTripSpan() === 'overnight';
  returnFieldLabel.textContent = overnight ? 'Day 2 Return' : 'Return';
  if (overnight) {
    stayToggle.classList.add('active');
    stayToggle.setAttribute('aria-pressed', 'true');
    stayToggle.disabled = true;
    stayLabel.textContent = '1박 필수';
    stayToggleText.textContent = '숙박 포함';
    setStatus('1박2일은 Day 1 출발 → 숙박 → Day 2 귀가 일정으로 생성됩니다.');
  } else {
    stayToggle.disabled = false;
    stayToggleText.textContent = '숙박 추천';
    stayLabel.textContent = stayToggle.classList.contains('active') ? '숙박 추천' : '숙박 없음';
  }
}

originField?.addEventListener('click', () => openPicker());
document.querySelector('#closeOriginPicker')?.addEventListener('click', closePicker);
document.querySelector('#useCurrentLocation')?.addEventListener('click', locate);
document.querySelectorAll('[data-focus-origin]').forEach((button) => button.addEventListener('click', () => {
  const target = button.dataset.focusOrigin === 'coords' ? '#manualLat' : '#manualAddress';
  document.querySelector(target)?.focus();
}));

const quickOrigins = document.querySelector('#quickOrigins');
quickOrigins.innerHTML = QUICK_ORIGINS.map((item) => `<button type="button" class="quick-origin" data-quick-origin="${item.id}">${item.shortLabel}</button>`).join('');
quickOrigins.querySelectorAll('[data-quick-origin]').forEach((button) => button.addEventListener('click', () => {
  const item = QUICK_ORIGINS.find((x) => x.id === button.dataset.quickOrigin);
  setOrigin(toOrigin(item));
}));

async function searchAndApplyOrigin() {
  const address = document.querySelector('#manualAddress').value.trim();
  if (!address) {
    setStatus('검색할 지역이나 장소를 입력해 주세요.', 'error');
    return;
  }

  const offline = findQuickOrigin(address);
  if (offline) {
    setOrigin(toOrigin(offline, 'offline-search'));
    return;
  }

  const keys = await getRuntimeKeys();
  if (!keys.kakaoRestApiKey && !keys.hasKakaoRestApiKey) {
    setStatus('주소 검색 API 키가 없습니다. 빠른 위치 선택 또는 좌표 입력을 사용해 주세요.', 'error');
    return;
  }

  setStatus('주소 좌표를 확인하고 있어요.');
  const apiOptions = {
    restApiKey: keys.kakaoRestApiKey,
    apiProxyBaseUrl: keys.kakaoApiProxyBaseUrl,
    hasKakaoRestApiKey: keys.hasKakaoRestApiKey,
    origin,
  };
  const geocoded = await geocodeAddress(address, apiOptions);
  const resolved = geocoded || await searchPlaceKeyword(address, apiOptions);
  if (!resolved) {
    setStatus('주소·장소 검색 결과를 찾지 못했습니다. 빠른 위치 또는 좌표 입력으로 계속할 수 있어요.', 'error');
    openPicker();
  } else setOrigin(resolved);
}

document.querySelector('#searchOrigin')?.addEventListener('click', searchAndApplyOrigin);
document.querySelector('#manualAddress')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); searchAndApplyOrigin(); }
});

document.querySelector('#applyCoordinates')?.addEventListener('click', () => {
  const lat = Number(document.querySelector('#manualLat').value);
  const lng = Number(document.querySelector('#manualLng').value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    setStatus('위도와 경도를 모두 입력해 주세요.', 'error');
    return;
  }
  const label = document.querySelector('#manualAddress').value.trim() || '직접 지정한 위치';
  setOrigin({ source:'manual', label, lat, lng });
});

stayToggle?.addEventListener('click', () => {
  if (activeTripSpan() === 'overnight') return;
  requestAnimationFrame(() => {
    stayLabel.textContent = stayToggle.classList.contains('active') ? '숙박 추천' : '숙박 없음';
  });
});

document.querySelectorAll('[data-segment="trip-span"]').forEach((button) => button.addEventListener('click', () => requestAnimationFrame(updateTripSpanUI)));

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  submit.disabled = true;
  try {
    if (!origin) {
      openPicker();
      setStatus('출발지를 먼저 선택해 주세요. 현재 위치를 자동으로 사용하지 않습니다.', 'error');
      return;
    }
    const tripSpan = activeTripSpan();
    const transport = document.querySelector('[data-segment="transport"].active')?.dataset.value || 'transit';
    const moods = [...document.querySelectorAll('[data-mood].active')].map((button) => button.dataset.value);
    const input = {
      origin,
      tripSpan,
      startAt: buildTodayTime(document.querySelector('#startTime').value),
      endAt: buildTripEndTime(document.querySelector('#returnTime').value, tripSpan),
      transport,
      returnMode: 'origin',
      accommodation: tripSpan === 'overnight' ? true : stayToggle.classList.contains('active'),
      moods,
    };
    const checked = validatePlannerInput(input);
    if (!checked.valid) {
      setStatus(checked.errors.join(' '), 'error');
      return;
    }
    savePlannerInput(checked.input);
    location.href = 'result.html';
  } finally {
    submit.disabled = false;
  }
});

document.querySelectorAll('[data-home-sample]').forEach((link) => link.addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('#plannerForm')?.scrollIntoView({ behavior:'smooth', block:'center' });
  setStatus('예시 엽서예요. 출발지와 시간을 정하면 실제 일정 3안을 만들어드릴게요.');
  originField?.focus({ preventScroll:true });
}));

originLabel.textContent = '출발지 선택';
updateTripSpanUI();

const signedInUser = getCurrentUser();
if (signedInUser && !hasCompletedPreference(signedInUser.id)) {
  location.replace('onboarding.html?first=1');
}
