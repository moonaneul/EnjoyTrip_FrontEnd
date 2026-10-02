import { getCurrentUser } from '../core/authStorage.js';
import { createDefaultPreference } from '../features/preferences/defaultPreference.js';
import { saveUserPreference, getUserPreference } from '../features/preferences/preferenceStorage.js';
import { CATEGORY_OPTIONS } from '../features/onboarding/surveyConfig.js';
import { preferenceSummary } from '../features/preferences/preferenceScoring.js';

const user = getCurrentUser();
const params = new URLSearchParams(location.search);
const editing = params.get('edit') === '1';
if (!user) location.replace('login.html?next=onboarding');
if (editing) document.querySelector('#skipSurvey')?.setAttribute('hidden', '');

const form = document.querySelector('#preferenceForm');
const steps = [...document.querySelectorAll('[data-survey-step]')];
const progress = document.querySelector('#surveyProgress');
const nextButton = document.querySelector('#surveyNext');
const prevButton = document.querySelector('#surveyPrev');
const completeButton = document.querySelector('#surveyComplete');
const summary = document.querySelector('#surveySummary');
let current = 0;

const existing = getUserPreference(user?.id);
const state = existing || createDefaultPreference();

function renderCategories() {
  const root = document.querySelector('#categoryChoices');
  root.innerHTML = CATEGORY_OPTIONS.map(([key, emoji, label]) => {
    const active = (state.categoryWeights?.[key] ?? 0.5) >= 0.75;
    return `<button type="button" class="survey-choice ${active ? 'active' : ''}" data-category="${key}" aria-pressed="${active}"><span>${emoji}</span>${label}</button>`;
  }).join('');
  root.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
    button.classList.toggle('active');
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  }));
}

function syncInitial() {
  renderCategories();
  form.pace.value = String(Math.round((state.pace ?? 0.5) * 100));
  form.discoveryStyle.value = String(Math.round((state.discoveryStyle ?? 0.5) * 100));
  for (const name of ['travelTolerance','walkingTolerance','environmentPreference','atmospherePreference']) {
    const target = form.querySelector(`[name="${name}"][value="${state[name]}"]`);
    if (target) target.checked = true;
  }
  form.foodImportance.value = String(Math.round((state.foodImportance ?? 0.5) * 100));
  form.cafeImportance.value = String(Math.round((state.cafeImportance ?? 0.5) * 100));
  form.restImportance.value = String(Math.round((state.restImportance ?? 0.5) * 100));
}

function collect() {
  const categoryWeights = {};
  for (const [key] of CATEGORY_OPTIONS) {
    const active = Boolean(document.querySelector(`[data-category="${key}"]`)?.classList.contains('active'));
    categoryWeights[key] = active ? 0.9 : 0.45;
  }
  return {
    ...state,
    categoryWeights,
    pace:Number(form.pace.value)/100,
    travelTolerance:form.querySelector('[name="travelTolerance"]:checked')?.value || 'medium',
    walkingTolerance:form.querySelector('[name="walkingTolerance"]:checked')?.value || 'medium',
    discoveryStyle:Number(form.discoveryStyle.value)/100,
    environmentPreference:form.querySelector('[name="environmentPreference"]:checked')?.value || 'balanced',
    atmospherePreference:form.querySelector('[name="atmospherePreference"]:checked')?.value || 'balanced',
    foodImportance:Number(form.foodImportance.value)/100,
    cafeImportance:Number(form.cafeImportance.value)/100,
    restImportance:Number(form.restImportance.value)/100,
    completed:true,
  };
}

function renderSummary() {
  const next = collect();
  const top = preferenceSummary(next);
  const pace = next.pace < 0.35 ? '느긋한 일정' : next.pace > 0.7 ? '꽉 채운 일정' : '균형 잡힌 일정';
  const travel = next.travelTolerance === 'low' ? '가까운 곳 위주' : next.travelTolerance === 'high' ? '좋은 곳이면 이동 OK' : '적당한 이동';
  summary.innerHTML = `<div class="summary-stamp">YOUR TEUM</div><h2>${user?.nickname || '여행자'}님의 여행 취향</h2><p class="summary-tags">${top.map((item)=>`<span>${item}</span>`).join('')}</p><p>${pace} · ${travel}</p><small>이 취향은 마이페이지에서 언제든 다시 바꿀 수 있어요.</small>`;
}

function showStep(index) {
  current = Math.max(0, Math.min(steps.length - 1, index));
  steps.forEach((step, i) => step.hidden = i !== current);
  progress.style.width = `${((current + 1) / steps.length) * 100}%`;
  prevButton.hidden = current === 0;
  nextButton.hidden = current === steps.length - 1;
  completeButton.hidden = current !== steps.length - 1;
  if (current === steps.length - 1) renderSummary();
}

nextButton.addEventListener('click', () => showStep(current + 1));
prevButton.addEventListener('click', () => showStep(current - 1));
completeButton.addEventListener('click', () => {
  if (!user) return;
  saveUserPreference(user.id, collect());
  location.href = editing ? 'mypage.html?preferenceUpdated=1' : 'index.html?onboarded=1';
});

document.querySelector('#skipSurvey')?.addEventListener('click', () => {
  if (!user) return;
  saveUserPreference(user.id, { ...createDefaultPreference(), completed:true, preferenceMode:'neutral' });
  location.href = editing ? 'mypage.html?preferenceUpdated=1' : 'index.html?onboarded=1';
});

syncInitial();
showStep(0);
