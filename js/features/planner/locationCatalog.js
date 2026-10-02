export const QUICK_ORIGINS = Object.freeze([
  { id:'gwangju-acc', label:'광주 · 국립아시아문화전당', shortLabel:'광주 ACC', lat:35.1466, lng:126.9199, keywords:['광주','acc','국립아시아문화전당','문화전당','충장로','동명동'] },
  { id:'gwangju-cityhall', label:'광주 · 시청/상무지구', shortLabel:'광주 시청', lat:35.1601, lng:126.8514, keywords:['광주','시청','상무','상무지구'] },
  { id:'gwangju-songjeong', label:'광주 · 광주송정역', shortLabel:'광주송정역', lat:35.1375, lng:126.7915, keywords:['광주','송정','광주송정역','송정역'] },
  { id:'seoul-cityhall', label:'서울 · 서울시청', shortLabel:'서울시청', lat:37.5665, lng:126.9780, keywords:['서울','시청','서울시청','중구'] },
]);

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function findQuickOrigin(query) {
  const q = normalize(query);
  if (!q) return null;
  return QUICK_ORIGINS.find((item) => [item.label, item.shortLabel, ...(item.keywords || [])]
    .some((keyword) => normalize(keyword).includes(q) || q.includes(normalize(keyword)))) || null;
}

export function toOrigin(item, source = 'preset') {
  if (!item) return null;
  return { source, label:item.label, lat:Number(item.lat), lng:Number(item.lng) };
}
