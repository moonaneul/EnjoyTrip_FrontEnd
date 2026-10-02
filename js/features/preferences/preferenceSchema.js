import { createDefaultPreference, SURVEY_VERSION } from './defaultPreference.js';

const ENUMS = Object.freeze({
  travelTolerance: new Set(['low', 'medium', 'high']),
  walkingTolerance: new Set(['low', 'medium', 'high']),
  environmentPreference: new Set(['indoor', 'balanced', 'outdoor']),
  atmospherePreference: new Set(['quiet', 'balanced', 'lively']),
});

const CATEGORY_KEYS = ['nature','food','cafe','culture','history','shopping','photo','local','activity'];
const clamp = (value, fallback = 0.5) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

export function normalizePreference(raw = {}) {
  const base = createDefaultPreference();
  const categoryWeights = { ...base.categoryWeights };
  for (const key of CATEGORY_KEYS) categoryWeights[key] = clamp(raw?.categoryWeights?.[key], categoryWeights[key]);
  const next = {
    ...base,
    ...raw,
    surveyVersion: Number(raw.surveyVersion) || SURVEY_VERSION,
    categoryWeights,
    pace: clamp(raw.pace, base.pace),
    discoveryStyle: clamp(raw.discoveryStyle, base.discoveryStyle),
    foodImportance: clamp(raw.foodImportance, base.foodImportance),
    cafeImportance: clamp(raw.cafeImportance, base.cafeImportance),
    restImportance: clamp(raw.restImportance, base.restImportance),
    completed: Boolean(raw.completed),
  };
  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (!allowed.has(next[field])) next[field] = base[field];
  }
  return next;
}

export function validatePreference(raw) {
  const normalized = normalizePreference(raw);
  const errors = [];
  if (!raw || typeof raw !== 'object') errors.push('Preference 객체가 필요합니다.');
  if (normalized.surveyVersion < 1) errors.push('surveyVersion이 올바르지 않습니다.');
  return { valid: errors.length === 0, errors, preference: normalized };
}

export { CATEGORY_KEYS };
