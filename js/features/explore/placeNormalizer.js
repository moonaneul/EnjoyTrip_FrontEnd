const TYPE_BY_CONTENT_TYPE_ID = Object.freeze({
  '12': 'attraction',
  '14': 'culture',
  '15': 'event',
  '25': 'course',
  '32': 'lodging',
  '38': 'shopping',
  '39': 'food',
});

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanTourText(value) {
  const text = textOrNull(value);
  if (!text) return null;

  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || null;
}

function joinAddress(raw) {
  return [textOrNull(raw.addr1), textOrNull(raw.addr2)].filter(Boolean).join(' ').trim();
}

function getIntroOpenFields(contentTypeId, intro = {}) {
  switch (String(contentTypeId || '')) {
    case '12':
      return { text: intro.usetime, restDate: intro.restdate };
    case '14':
      return { text: intro.usetimeculture, restDate: intro.restdateculture };
    case '15': {
      const start = textOrNull(intro.eventstartdate);
      const end = textOrNull(intro.eventenddate);
      return {
        text: start || end ? `행사기간 ${start || '?'} ~ ${end || '?'}` : null,
        restDate: null,
      };
    }
    case '25':
      return { text: null, restDate: null };
    case '32': {
      const checkin = textOrNull(intro.checkintime);
      const checkout = textOrNull(intro.checkouttime);
      return {
        text: checkin || checkout ? `입실 ${checkin || '확인 필요'} · 퇴실 ${checkout || '확인 필요'}` : null,
        restDate: null,
      };
    }
    case '38':
      return { text: intro.opentime, restDate: intro.restdateshopping };
    case '39':
      return { text: intro.opentimefood, restDate: intro.restdatefood };
    default:
      return { text: null, restDate: null };
  }
}

/**
 * TourAPI raw item을 Shared Contract의 Place 형태로 변환한다.
 * 운영 여부는 현재 시각을 기준으로 추측하지 않는다.
 * 제공된 운영 텍스트가 있어도 status는 unknown으로 유지한다.
 */
export function normalizePlace(raw = {}, { intro = null } = {}) {
  const contentId = textOrNull(raw.contentid ?? raw.contentId) || '';
  const contentTypeId = textOrNull(raw.contenttypeid ?? raw.contentTypeId) || '';
  const introItem = intro || raw.__intro || {};
  const openFields = getIntroOpenFields(contentTypeId, introItem);

  return {
    id: contentId,
    contentId,
    contentTypeId,
    type: TYPE_BY_CONTENT_TYPE_ID[contentTypeId] || 'unknown',
    title: textOrNull(raw.title) || '',
    address: joinAddress(raw),
    lat: numberOrNull(raw.mapy ?? raw.mapY),
    lng: numberOrNull(raw.mapx ?? raw.mapX),
    imageUrl: textOrNull(raw.firstimage ?? raw.firstImage),
    tel: textOrNull(raw.tel),
    categoryPath: null,
    overview: cleanTourText(raw.overview),
    openInfo: {
      status: 'unknown',
      text: cleanTourText(openFields.text),
      restDate: cleanTourText(openFields.restDate),
    },
    raw,
  };
}

export function normalizePlaces(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => normalizePlace(item));
}

export function contentTypeIdToPlaceType(contentTypeId) {
  return TYPE_BY_CONTENT_TYPE_ID[String(contentTypeId)] || 'unknown';
}
