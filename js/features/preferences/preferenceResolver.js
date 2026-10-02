import { createDefaultPreference } from './defaultPreference.js';
import { normalizePreference } from './preferenceSchema.js';

const MOOD_BOOSTS = Object.freeze({
  '산책': { nature: 0.18, photo: 0.08, local: 0.08 },
  '카페': { cafe: 0.24, food: 0.08, local: 0.06 },
  '문화': { culture: 0.24, history: 0.08 },
});

const clamp = (n) => Math.max(0, Math.min(1, n));

export function resolvePreference({ userPreference, tripContext } = {}) {
  const source = userPreference ? normalizePreference(userPreference) : createDefaultPreference();
  const effective = {
    ...source,
    categoryWeights: { ...source.categoryWeights },
    source: userPreference?.completed && userPreference?.preferenceMode !== 'neutral' ? 'user' : 'neutral',
    tripOverrides: [],
  };

  for (const mood of tripContext?.moods || tripContext?.temporaryMoods || []) {
    const boosts = MOOD_BOOSTS[mood];
    if (!boosts) continue;
    effective.tripOverrides.push(mood);
    for (const [category, amount] of Object.entries(boosts)) {
      effective.categoryWeights[category] = clamp((effective.categoryWeights[category] ?? 0.5) + amount);
    }
  }

  const overrides = tripContext?.preferenceOverrides || {};
  for (const category of overrides.boostedCategories || []) {
    if (category in effective.categoryWeights) effective.categoryWeights[category] = clamp(effective.categoryWeights[category] + 0.2);
  }
  for (const category of overrides.excludedCategories || []) {
    if (category in effective.categoryWeights) effective.categoryWeights[category] = Math.min(effective.categoryWeights[category], 0.15);
  }

  return effective;
}
