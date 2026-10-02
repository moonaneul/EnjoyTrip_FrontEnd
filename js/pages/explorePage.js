import {
  getRegions,
  getSubregions,
  searchPlaces,
  TourApiConfigError,
  TourApiError,
} from '../api/tourApi.js';
import { TimeoutError, NetworkError, HttpError } from '../core/http.js';

const form = document.querySelector('#explore-form');
const regionSelect = document.querySelector('#region-select');
const subregionSelect = document.querySelector('#subregion-select');
const categoryButtons = [...document.querySelectorAll('[data-place-type]')];
const state = document.querySelector('#explore-state');
const grid = document.querySelector('#place-grid');
const summary = document.querySelector('#results-summary');
const loadMoreWrap = document.querySelector('#load-more-wrap');
const loadMoreButton = document.querySelector('#load-more-button');
const submitButton = form.querySelector('.search-button');

const PAGE_SIZE = 12;
let selectedType = 'attraction';
let currentPage = 1;
let currentPlaces = [];
let lastQuerySignature = '';
let searchRequestId = 0;
let subregionRequestId = 0;

const TYPE_LABEL = Object.freeze({
  attraction: '관광',
  food: '음식',
  lodging: '숙박',
  culture: '문화',
  event: '행사',
  course: '코스',
  shopping: '쇼핑',
});

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setState(mode, title, message, { retry = null } = {}) {
  grid.hidden = true;
  loadMoreWrap.hidden = true;
  state.hidden = false;

  if (mode === 'loading') {
    state.innerHTML = '<span class="state-spinner" aria-hidden="true"></span>' +
      `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
    return;
  }

  const retryButton = retry
    ? `<button type="button" class="state-retry-button" data-retry="${escapeHtml(retry)}">다시 시도</button>`
    : '';

  state.innerHTML = '<div class="state-postmark" aria-hidden="true">TEUM</div>' +
    `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>${retryButton}`;
}

function errorMessage(error) {
  if (error instanceof TourApiConfigError) {
    return '공공데이터 서비스키가 아직 설정되지 않았어요. js/config/keys.local.js 설정이 필요합니다.';
  }
  if (error instanceof TimeoutError) return '관광정보 응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요.';
  if (error instanceof NetworkError) return '네트워크 연결을 확인한 뒤 다시 시도해주세요.';
  if (error instanceof HttpError) return `관광정보 서버가 HTTP ${error.status ?? '오류'}를 반환했어요.`;
  if (error instanceof TourApiError) return `TourAPI 응답 오류: ${error.resultMsg || error.message}`;
  return '관광정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
}

function fillSelect(select, items, firstLabel) {
  select.innerHTML = `<option value="">${firstLabel}</option>`;
  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.code;
    option.textContent = item.name;
    select.append(option);
  });
}

async function initializeRegions() {
  regionSelect.disabled = true;
  regionSelect.innerHTML = '<option value="">지역 불러오는 중...</option>';

  try {
    const regions = await getRegions();
    fillSelect(regionSelect, regions, '지역을 선택해주세요');
    regionSelect.disabled = false;
    return regions;
  } catch (error) {
    console.error(error);
    regionSelect.innerHTML = '<option value="">지역 정보를 불러오지 못했습니다</option>';
    setState('error', '지역 정보를 불러오지 못했어요.', errorMessage(error), { retry: 'regions' });
    return [];
  }
}

async function updateSubregions() {
  const requestId = ++subregionRequestId;
  const regionCode = regionSelect.value;
  subregionSelect.disabled = true;
  subregionSelect.innerHTML = '<option value="">불러오는 중...</option>';

  if (!regionCode) {
    subregionSelect.innerHTML = '<option value="">전체</option>';
    return [];
  }

  try {
    const subregions = await getSubregions(regionCode);
    if (requestId !== subregionRequestId) return [];
    fillSelect(subregionSelect, subregions, '전체');
    subregionSelect.disabled = false;
    return subregions;
  } catch (error) {
    if (requestId !== subregionRequestId) return [];
    console.error(error);
    subregionSelect.innerHTML = '<option value="">전체</option>';
    subregionSelect.disabled = false;
    return [];
  }
}

function buildPlaceUrl(place) {
  const query = currentQuery();
  const params = new URLSearchParams({
    contentId: place.contentId,
    contentTypeId: place.contentTypeId,
    areaCode: query.areaCode,
    type: query.type,
  });
  if (query.sigunguCode) params.set('sigunguCode', query.sigunguCode);
  return `place.html?${params.toString()}`;
}

function cardTemplate(place) {
  const image = place.imageUrl
    ? `<img src="${escapeHtml(place.imageUrl)}" alt="${escapeHtml(place.title)} 대표 이미지" loading="lazy">`
    : '<div class="place-card-no-image">대표 이미지가 없는 여행지예요.</div>';
  const address = place.address || '주소 정보 확인 필요';

  return `
    <article class="place-card">
      <a class="place-card-link" href="${escapeHtml(buildPlaceUrl(place))}">
        <div class="place-card-photo">
          ${image}
          <span class="place-card-badge">${escapeHtml(TYPE_LABEL[place.type] || '여행')}</span>
        </div>
        <div class="place-card-body">
          <p class="place-card-kicker">TourAPI postcard</p>
          <h3 class="place-card-title">${escapeHtml(place.title || '이름 확인 필요')}</h3>
          <p class="place-card-address">${escapeHtml(address)}</p>
          <div class="place-card-foot">
            <span>한국관광공사</span>
            <span class="place-card-cta">자세히 보기 →</span>
          </div>
        </div>
      </a>
    </article>`;
}

function renderPlaces(places, { append = false } = {}) {
  if (!append) grid.innerHTML = '';
  grid.insertAdjacentHTML('beforeend', places.map(cardTemplate).join(''));
  state.hidden = true;
  grid.hidden = false;
}

function currentQuery() {
  return {
    areaCode: regionSelect.value,
    sigunguCode: subregionSelect.value,
    type: selectedType,
  };
}

function querySignature(query) {
  return `${query.areaCode}|${query.sigunguCode}|${query.type}`;
}

function syncUrl(query) {
  const params = new URLSearchParams();
  if (query.areaCode) params.set('areaCode', query.areaCode);
  if (query.sigunguCode) params.set('sigunguCode', query.sigunguCode);
  if (query.type) params.set('type', query.type);
  const nextUrl = params.size ? `explore.html?${params.toString()}` : 'explore.html';
  history.replaceState(null, '', nextUrl);
}

function setSelectedType(type) {
  if (!TYPE_LABEL[type]) return;
  selectedType = type;
  categoryButtons.forEach((item) => {
    const active = item.dataset.placeType === type;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
}

function replaceBrokenImage(img) {
  const photoBox = img.closest('.place-card-photo');
  if (!photoBox) return;
  img.remove();
  if (!photoBox.querySelector('.place-card-no-image')) {
    const fallback = document.createElement('div');
    fallback.className = 'place-card-no-image';
    fallback.textContent = '대표 이미지를 불러오지 못했어요.';
    photoBox.prepend(fallback);
  }
}

async function runSearch({ append = false } = {}) {
  const query = currentQuery();
  if (!query.areaCode) {
    setState('initial', '지역을 먼저 골라주세요.', '지역을 선택하면 해당 지역의 여행지를 찾아드릴게요.');
    regionSelect.focus();
    return;
  }

  const requestId = ++searchRequestId;
  const signature = querySignature(query);
  if (!append || signature !== lastQuerySignature) {
    currentPage = 1;
    currentPlaces = [];
    lastQuerySignature = signature;
  }

  syncUrl(query);
  submitButton.disabled = true;
  loadMoreButton.disabled = true;
  if (!append) setState('loading', '여행지 엽서를 고르는 중이에요.', '한국관광공사 관광정보를 불러오고 있어요.');

  try {
    const places = await searchPlaces({
      ...query,
      page: currentPage,
      size: PAGE_SIZE,
    });

    if (requestId !== searchRequestId) return;

    if (!append && places.length === 0) {
      summary.textContent = `${regionSelect.selectedOptions[0].text} · ${TYPE_LABEL[selectedType]} 검색 결과 0건`;
      setState('empty', '아직 보여드릴 여행지가 없어요.', '다른 카테고리나 지역으로 다시 찾아보세요.');
      return;
    }

    if (append && places.length === 0) {
      summary.textContent = `${regionSelect.selectedOptions[0].text} · ${TYPE_LABEL[selectedType]} · ${currentPlaces.length}곳 · 마지막 페이지예요.`;
      loadMoreWrap.hidden = true;
      return;
    }

    currentPlaces = append ? [...currentPlaces, ...places] : places;
    renderPlaces(places, { append });
    summary.textContent = `${regionSelect.selectedOptions[0].text} · ${TYPE_LABEL[selectedType]} · 현재 ${currentPlaces.length}곳`;
    loadMoreWrap.hidden = places.length < PAGE_SIZE;
    loadMoreButton.textContent = '조금 더 둘러보기';
  } catch (error) {
    if (requestId !== searchRequestId) return;
    console.error(error);
    if (append) {
      currentPage -= 1;
      grid.hidden = false;
      state.hidden = true;
      loadMoreWrap.hidden = false;
      loadMoreButton.textContent = '다시 불러오기';
      summary.textContent = `추가 여행지를 불러오지 못했어요. ${errorMessage(error)}`;
    } else {
      setState('error', '여행지를 불러오지 못했어요.', errorMessage(error), { retry: 'search' });
    }
  } finally {
    if (requestId === searchRequestId) {
      submitButton.disabled = false;
      loadMoreButton.disabled = false;
    }
  }
}

async function restoreFromUrl() {
  const params = new URLSearchParams(location.search);
  const areaCode = params.get('areaCode');
  const sigunguCode = params.get('sigunguCode');
  const type = params.get('type');

  await initializeRegions();

  if (type && TYPE_LABEL[type]) setSelectedType(type);
  if (!areaCode) return;

  const regionOption = [...regionSelect.options].find((option) => option.value === areaCode);
  if (!regionOption) return;

  regionSelect.value = areaCode;
  await updateSubregions();

  if (sigunguCode) {
    const subregionOption = [...subregionSelect.options].find((option) => option.value === sigunguCode);
    if (subregionOption) subregionSelect.value = sigunguCode;
  }

  await runSearch();
}

regionSelect.addEventListener('change', async () => {
  await updateSubregions();
  if (regionSelect.value) runSearch();
});

subregionSelect.addEventListener('change', () => {
  if (regionSelect.value) runSearch();
});

categoryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setSelectedType(button.dataset.placeType);
    if (regionSelect.value) runSearch();
  });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch();
});

loadMoreButton.addEventListener('click', async () => {
  currentPage += 1;
  await runSearch({ append: true });
});

state.addEventListener('click', async (event) => {
  const retryButton = event.target.closest('[data-retry]');
  if (!retryButton) return;

  if (retryButton.dataset.retry === 'regions') {
    setState('loading', '지역 정보를 다시 불러오는 중이에요.', '잠시만 기다려주세요.');
    await initializeRegions();
    return;
  }

  if (retryButton.dataset.retry === 'search') await runSearch();
});

grid.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement) replaceBrokenImage(event.target);
}, true);

restoreFromUrl();
