import { formatTime, formatDateTime } from '../recommendation/time.js';

function routeText(route) {
  if (!route) return '이동 정보 없음';
  const label = route.providerStatus === 'estimated' ? '예상 ' : '';
  const fare = Number.isFinite(route.fare) ? ` · ₩${route.fare.toLocaleString('ko-KR')}` : '';
  const fallback = route.fallbackReason ? ' · Kakao fallback' : '';
  const modeLabel = route.mode === 'car' ? '자차' : route.mode === 'walk' ? '도보' : '대중교통';
  return `${label}${modeLabel} ${route.durationMin}분${fare}${fallback}`;
}

function pushDayHeader(items, day, date) {
  items.push({
    time: `DAY ${day}`,
    title: `${day}일차`,
    description: date ? formatDateTime(date) : '',
    kind: 'DAY',
    divider: true,
  });
}

export function buildTimeline(plan, input) {
  if (!plan) return [];
  const items = [];
  const overnight = plan.tripSpan === 'overnight' || input?.tripSpan === 'overnight';
  const day1Entries = (plan.places || []).filter((entry) => entry.day !== 2);
  const day2Entries = (plan.places || []).filter((entry) => entry.day === 2);

  if (overnight) pushDayHeader(items, 1, plan.startAt);
  let cursor = new Date(plan.startAt);
  day1Entries.forEach((entry, index) => {
    items.push({
      time: formatTime(cursor),
      title: index === 0 ? `${input?.origin?.label || '출발지'} 출발` : `${day1Entries[index - 1].place.title}에서 이동`,
      description: routeText(entry.travelFromPrevious),
      kind: '이동',
    });
    items.push({ time: formatTime(entry.arriveAt), title: entry.place.title, description: `${entry.dwellMin}분 · ${entry.place.categoryPath || entry.place.type}`, kind: entry.place.type === 'food' ? '식사' : '관광' });
    cursor = new Date(entry.leaveAt);
  });

  if (plan.lodging && plan.lodgingRoute) {
    items.push({ time: formatTime(cursor), title: '숙소로 이동', description: routeText(plan.lodgingRoute), kind: '이동' });
    items.push({ time: formatTime(plan.lodgingArrivalAt || plan.returnAt), title: plan.lodging.title, description: overnight ? '1박 · 체크인' : '숙박 추천 · 체크인', kind: '숙박' });
  }

  if (overnight) {
    const day2Start = plan.day2StartAt || day2Entries[0]?.arriveAt;
    pushDayHeader(items, 2, day2Start);
    cursor = new Date(day2Start);
    day2Entries.forEach((entry, index) => {
      items.push({
        time: formatTime(cursor),
        title: index === 0 ? `${plan.lodging?.title || '숙소'} 출발` : `${day2Entries[index - 1].place.title}에서 이동`,
        description: routeText(entry.travelFromPrevious),
        kind: '이동',
      });
      items.push({ time: formatTime(entry.arriveAt), title: entry.place.title, description: `${entry.dwellMin}분 · ${entry.place.categoryPath || entry.place.type}`, kind: entry.place.type === 'food' ? '식사' : '관광' });
      cursor = new Date(entry.leaveAt);
    });
    if (plan.returnRoute) {
      items.push({ time: formatTime(cursor), title: '귀가 시작', description: routeText(plan.returnRoute), kind: '이동' });
      items.push({ time: formatTime(plan.returnAt), title: `${input?.origin?.label || '출발지'} 도착`, description: '1박2일 일정 종료', kind: '완료' });
    }
  } else if (!plan.lodging && plan.returnRoute) {
    items.push({ time: formatTime(cursor), title: '귀가 시작', description: routeText(plan.returnRoute), kind: '이동' });
    items.push({ time: formatTime(plan.returnAt), title: `${input?.origin?.label || '출발지'} 도착`, description: '일정 종료', kind: '완료' });
  }
  return items;
}
