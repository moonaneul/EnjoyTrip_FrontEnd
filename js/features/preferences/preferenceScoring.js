const TYPE_CATEGORY = Object.freeze({
  attraction: ['nature','photo','history','local'],
  culture: ['culture','history'],
  event: ['culture','activity','local'],
  course: ['nature','activity','photo','local'],
  shopping: ['shopping','local'],
  food: ['food','cafe','local'],
  lodging: [],
  unknown: ['local'],
});

const KEYWORDS = Object.freeze({
  nature: ['공원','숲','산','호수','해변','바다','천','정원','수목원','습지','폭포','계곡'],
  cafe: ['카페','커피','찻집','티룸','베이커리'],
  culture: ['미술관','박물관','전시','문화','아트','갤러리','극장','공연'],
  history: ['역사','기념','사적','궁','성','향교','한옥','유적','민주'],
  shopping: ['시장','쇼핑','몰','백화점','상점'],
  photo: ['전망','전망대','스카이','야경','포토','뷰'],
  local: ['골목','마을','시장','거리','동네','로컬'],
  activity: ['체험','레저','스포츠','케이블카','자전거','트레킹','등산'],
  food: ['식당','맛집','음식','시장','키친','레스토랑'],
});

const INDOOR_TYPES = new Set(['culture','shopping','food']);
const OUTDOOR_TYPES = new Set(['attraction','course']);
const LIVELY_TYPES = new Set(['event','shopping','food']);
const QUIET_TYPES = new Set(['course','culture','attraction']);

function haystack(place) {
  return `${place?.title || ''} ${place?.categoryPath || ''} ${place?.overview || ''}`.toLowerCase();
}

function categoryScore(place, preference) {
  const weights = preference?.categoryWeights || {};
  const categories = TYPE_CATEGORY[place?.type] || TYPE_CATEGORY.unknown;
  let score = categories.length ? Math.max(...categories.map((key) => weights[key] ?? 0.5)) : 0.5;
  const text = haystack(place);
  for (const [category, words] of Object.entries(KEYWORDS)) {
    if (words.some((word) => text.includes(word.toLowerCase()))) score = Math.max(score, weights[category] ?? 0.5);
  }
  return score;
}

function travelToleranceFactor(distanceM, tolerance = 'medium') {
  const km = Math.max(0, Number(distanceM) || 0) / 1000;
  const max = tolerance === 'low' ? 8 : tolerance === 'high' ? 24 : 16;
  return Math.max(0, 1 - km / max);
}

function walkingFactor(place, tolerance = 'medium') {
  if (tolerance === 'medium') return 0.6;
  const walkingHeavy = place?.type === 'course' || place?.type === 'attraction';
  if (tolerance === 'high') return walkingHeavy ? 1 : 0.65;
  return walkingHeavy ? 0.28 : 0.72;
}

function environmentFactor(place, preference = 'balanced') {
  if (preference === 'balanced') return 0.65;
  const type = place?.type;
  if (preference === 'indoor') {
    if (INDOOR_TYPES.has(type)) return 1;
    if (OUTDOOR_TYPES.has(type)) return 0.35;
  }
  if (preference === 'outdoor') {
    if (OUTDOOR_TYPES.has(type)) return 1;
    if (INDOOR_TYPES.has(type)) return 0.4;
  }
  return 0.6;
}

function atmosphereFactor(place, preference = 'balanced') {
  if (preference === 'balanced') return 0.65;
  const type = place?.type;
  if (preference === 'quiet') return QUIET_TYPES.has(type) ? 0.9 : LIVELY_TYPES.has(type) ? 0.4 : 0.6;
  if (preference === 'lively') return LIVELY_TYPES.has(type) ? 0.9 : QUIET_TYPES.has(type) ? 0.48 : 0.6;
  return 0.6;
}

function foodContextFactor(place, preference) {
  if (place?.type !== 'food') return 0.5;
  const text = haystack(place);
  const cafeLike = KEYWORDS.cafe.some((word) => text.includes(word.toLowerCase()));
  return cafeLike ? (preference.cafeImportance ?? 0.5) : (preference.foodImportance ?? 0.5);
}

export function scorePlacePreference(place, preference, { distanceM = 0 } = {}) {
  if (!preference) return 0.5;
  const category = categoryScore(place, preference);
  const distance = travelToleranceFactor(distanceM, preference.travelTolerance);
  const discovery = place?.type === 'attraction' || place?.type === 'course' || place?.type === 'event'
    ? 0.45 + (preference.discoveryStyle || 0.5) * 0.35
    : 0.5;
  const foodContext = foodContextFactor(place, preference);
  const environment = environmentFactor(place, preference.environmentPreference);
  const atmosphere = atmosphereFactor(place, preference.atmospherePreference);
  const walking = walkingFactor(place, preference.walkingTolerance);
  return category * 0.48
    + distance * 0.15
    + discovery * 0.08
    + foodContext * 0.08
    + environment * 0.08
    + atmosphere * 0.06
    + walking * 0.07;
}

export function preferenceSummary(preference) {
  if (!preference) return [];
  const labels = {
    nature:'자연', food:'맛집', cafe:'카페', culture:'문화', history:'역사', shopping:'쇼핑', photo:'사진·전망', local:'로컬', activity:'체험',
  };
  return Object.entries(preference.categoryWeights || {})
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3)
    .map(([key])=>labels[key] || key);
}
