import { getPlaceDetail, TourApiConfigError, TourApiError } from '../api/tourApi.js';
import { TimeoutError, NetworkError, HttpError } from '../core/http.js';

const state = document.querySelector('#place-state');
const detail = document.querySelector('#place-detail');
const photo = document.querySelector('#place-detail-photo');
const typeLabel = document.querySelector('#place-type-label');
const title = document.querySelector('#place-title');
const address = document.querySelector('#place-address');
const meta = document.querySelector('#place-meta');
const openTime = document.querySelector('#place-open-time');
const restDate = document.querySelector('#place-rest-date');
const overview = document.querySelector('#place-overview');
const overviewSection = document.querySelector('#overview-section');
const backLink = document.querySelector('.back-link');

const TYPE_LABEL = Object.freeze({
  attraction: '관광', food: '음식', lodging: '숙박', culture: '문화',
  event: '행사', course: '코스', shopping: '쇼핑', unknown: '여행지',
});

function showError(message, { retry = true } = {}) {
  detail.hidden = true;
  state.hidden = false;
  state.innerHTML = '<div class="state-postmark" aria-hidden="true">TEUM</div>' +
    `<strong>여행지 정보를 불러오지 못했어요.</strong><span>${message}</span>` +
    (retry ? '<button type="button" class="state-retry-button" data-detail-retry>다시 시도</button>' : '');
}

function showLoading() {
  detail.hidden = true;
  state.hidden = false;
  state.innerHTML = '<span class="state-spinner" aria-hidden="true"></span>' +
    '<strong>여행지 정보를 불러오고 있어요.</strong><span>한국관광공사 관광정보를 확인하고 있어요.</span>';
}

function errorMessage(error) {
  if (error instanceof TourApiConfigError) return '공공데이터 서비스키 설정이 필요합니다.';
  if (error instanceof TimeoutError) return '관광정보 응답 시간이 초과됐어요.';
  if (error instanceof NetworkError) return '네트워크 연결을 확인해주세요.';
  if (error instanceof HttpError) return `관광정보 서버 오류(${error.status ?? 'HTTP'})가 발생했어요.`;
  if (error instanceof TourApiError) return error.resultMsg || error.message;
  return '잠시 후 다시 시도해주세요.';
}

function configureBackLink(params) {
  const areaCode = params.get('areaCode');
  const sigunguCode = params.get('sigunguCode');
  const type = params.get('type');
  const exploreParams = new URLSearchParams();

  if (areaCode) exploreParams.set('areaCode', areaCode);
  if (sigunguCode) exploreParams.set('sigunguCode', sigunguCode);
  if (type) exploreParams.set('type', type);

  backLink.href = exploreParams.size ? `explore.html?${exploreParams.toString()}` : 'explore.html';
}

function renderImage(place) {
  photo.replaceChildren();

  if (!place.imageUrl) {
    photo.classList.add('no-image');
    photo.textContent = '대표 이미지가 제공되지 않은 여행지예요.';
    return;
  }

  photo.classList.remove('no-image');
  const img = document.createElement('img');
  img.src = place.imageUrl;
  img.alt = `${place.title || '여행지'} 대표 이미지`;
  img.addEventListener('error', () => {
    photo.replaceChildren();
    photo.classList.add('no-image');
    photo.textContent = '대표 이미지를 불러오지 못했어요.';
  }, { once: true });
  photo.append(img);
}

function renderMeta(place) {
  meta.replaceChildren();
  const items = [];
  if (place.tel) items.push(`전화 ${place.tel}`);
  if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) items.push('좌표 정보 있음');
  items.push('한국관광공사 데이터');

  items.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'place-meta-chip';
    chip.textContent = item;
    meta.append(chip);
  });
}

function render(place) {
  document.title = `${place.title || '여행지'} — 틈`;
  typeLabel.textContent = `${TYPE_LABEL[place.type] || '여행지'} · TOURAPI`;
  title.textContent = place.title || '이름 확인 필요';
  address.textContent = place.address || '주소 정보 확인 필요';

  renderImage(place);
  renderMeta(place);

  openTime.textContent = place.openInfo?.text || '운영시간 확인 필요';
  restDate.textContent = place.openInfo?.restDate || '휴무일 확인 필요';

  if (place.overview) {
    overviewSection.hidden = false;
    overview.textContent = place.overview;
  } else {
    overviewSection.hidden = true;
    overview.textContent = '';
  }

  state.hidden = true;
  detail.hidden = false;
}

async function initialize() {
  const params = new URLSearchParams(location.search);
  configureBackLink(params);

  const contentId = params.get('contentId');
  const contentTypeId = params.get('contentTypeId');

  if (!contentId) {
    showError('잘못된 여행지 주소입니다. 여행지 목록에서 다시 선택해주세요.', { retry: false });
    return;
  }

  showLoading();
  try {
    const place = await getPlaceDetail(contentId, contentTypeId);
    render(place);
  } catch (error) {
    console.error(error);
    showError(errorMessage(error));
  }
}

state.addEventListener('click', (event) => {
  if (event.target.closest('[data-detail-retry]')) initialize();
});

initialize();
