import { deleteTrip, listTrips } from '../core/tripStorage.js';
import { visibleTripOwnerId } from '../integration/tripAuthBridge.js';
import { formatDuration, formatTime, formatDateTime } from '../features/recommendation/time.js';
import { revivePlan, saveActivePlan } from '../features/planner/plannerState.js';

const grid = document.querySelector('#savedGrid');
const empty = document.querySelector('#savedEmpty');
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const legacyLabels = { slow:'여유로운 틈', full:'빽빽한 틈', random:'랜덤 컨셉 틈' };
const planLabel = (plan) => plan?.strategyLabel ? `${plan.strategyIcon || '✦'} ${plan.strategyLabel}` : (legacyLabels[plan?.type] || plan?.type || '맞춤 여행');

function render() {
  const trips = listTrips({ ownerUserId: visibleTripOwnerId() });
  if (!trips.length) { grid.innerHTML=''; empty.hidden=false; return; }
  empty.hidden = true;
  grid.innerHTML = trips.map((trip) => {
    const plan = revivePlan(trip.plan);
    const input = trip.plannerInput || {};
    const date = new Date(trip.createdAt);
    const overnight = plan.tripSpan === 'overnight' || input.tripSpan === 'overnight';
    const period = overnight ? `${formatDateTime(plan.startAt)} → ${formatDateTime(plan.returnAt)}` : `${formatTime(plan.startAt)} → ${formatTime(plan.returnAt)}`;
    const duration = overnight ? `1박2일 · 활동 ${formatDuration(plan.activeDurationMin)}` : formatDuration(plan.totalDurationMin);
    return `<article class="saved-item" data-trip="${esc(trip.id)}"><div class="saved-item-top"><span class="saved-type">${esc(planLabel(plan))}${overnight ? ' · 1박2일' : ''}</span><span class="saved-date">${date.toLocaleDateString('ko-KR')}</span></div><h2>${esc(plan.title)}</h2><p>${esc(period)} · ${esc(duration)} · 장소 ${plan.places.length}${plan.lodging ? ' + 숙박' : ''}</p><div class="saved-actions"><a href="detail.html?trip=${encodeURIComponent(trip.id)}" data-open-saved="${esc(trip.id)}">상세 보기</a><button type="button" data-delete-trip="${esc(trip.id)}">삭제</button></div></article>`;
  }).join('');
  grid.querySelectorAll('[data-open-saved]').forEach((link) => link.addEventListener('click', () => {
    const trip = trips.find((item) => item.id === link.dataset.openSaved);
    if (trip) saveActivePlan(revivePlan(trip.plan));
  }));
  grid.querySelectorAll('[data-delete-trip]').forEach((button) => button.addEventListener('click', () => { deleteTrip(button.dataset.deleteTrip); render(); }));
}

render();
