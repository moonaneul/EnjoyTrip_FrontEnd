export function minutesBetween(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return NaN;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

export function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace('24:', '00:');
}

export function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  return `${new Intl.DateTimeFormat('ko-KR', { month:'numeric', day:'numeric' }).format(date)} ${formatTime(date)}`;
}

export function formatDuration(minutes) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (!hours) return `${mins}분`;
  if (!mins) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

export function toSerializableDate(date) {
  return date instanceof Date ? date.toISOString() : date;
}

export function reviveDate(value) {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildTodayTime(timeValue, base = new Date()) {
  const [hours, minutes] = String(timeValue || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const date = new Date(base);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function buildTripEndTime(timeValue, tripSpan = 'day', base = new Date()) {
  const date = buildTodayTime(timeValue, base);
  if (!date) return null;
  if (tripSpan === 'overnight') date.setDate(date.getDate() + 1);
  return date;
}
