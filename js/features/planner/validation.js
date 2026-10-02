import { hasValidCoordinates } from '../recommendation/distance.js';
import { minutesBetween, reviveDate } from '../recommendation/time.js';

export const MIN_TRIP_MINUTES = 120;
export const MIN_OVERNIGHT_MINUTES = 12 * 60;
export const MAX_OVERNIGHT_MINUTES = 47 * 60;

export function normalizePlannerInput(input) {
  if (!input) return null;
  const tripSpan = input.tripSpan === 'overnight' ? 'overnight' : 'day';
  return {
    ...input,
    tripSpan,
    dayCount: tripSpan === 'overnight' ? 2 : 1,
    origin: input.origin ? { ...input.origin, lat:Number(input.origin.lat), lng:Number(input.origin.lng) } : null,
    startAt: reviveDate(input.startAt),
    endAt: reviveDate(input.endAt),
    accommodation: tripSpan === 'overnight' ? true : Boolean(input.accommodation),
    moods: Array.isArray(input.moods) ? input.moods.filter(Boolean) : [],
  };
}

export function validatePlannerInput(rawInput) {
  const input = normalizePlannerInput(rawInput);
  const errors = [];
  if (!input?.origin || !hasValidCoordinates(input.origin)) errors.push('출발 위치를 선택해 주세요.');
  if (!input?.startAt || !input?.endAt) errors.push('출발 시간과 귀가 시간을 확인해 주세요.');
  if (input?.startAt && input?.endAt) {
    const duration = minutesBetween(input.startAt, input.endAt);
    if (duration <= 0) errors.push('귀가 시간은 출발 시간보다 늦어야 합니다.');
    else if (input.tripSpan === 'day' && duration < MIN_TRIP_MINUTES) errors.push(`당일 여행은 최소 ${MIN_TRIP_MINUTES}분 이상의 틈이 필요합니다.`);
    else if (input.tripSpan === 'overnight' && duration < MIN_OVERNIGHT_MINUTES) errors.push('1박2일은 최소 12시간 이상의 일정이 필요합니다.');
    else if (input.tripSpan === 'overnight' && duration > MAX_OVERNIGHT_MINUTES) errors.push('현재 버전은 최대 1박2일까지 지원합니다.');
    if (input.tripSpan === 'day' && input.startAt.toDateString() !== input.endAt.toDateString()) errors.push('당일 여행의 귀가일은 출발일과 같아야 합니다.');
  }
  if (!['transit', 'car'].includes(input?.transport)) errors.push('이동 수단을 선택해 주세요.');
  return { valid: errors.length === 0, errors, input };
}
