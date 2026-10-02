export const SURVEY_VERSION = 1;

export const DEFAULT_PREFERENCE = Object.freeze({
  surveyVersion: SURVEY_VERSION,
  categoryWeights: Object.freeze({
    nature: 0.5,
    food: 0.5,
    cafe: 0.5,
    culture: 0.5,
    history: 0.5,
    shopping: 0.5,
    photo: 0.5,
    local: 0.5,
    activity: 0.5,
  }),
  pace: 0.5,
  travelTolerance: 'medium',
  walkingTolerance: 'medium',
  discoveryStyle: 0.5,
  environmentPreference: 'balanced',
  atmospherePreference: 'balanced',
  foodImportance: 0.5,
  cafeImportance: 0.5,
  restImportance: 0.5,
  completed: false,
});

export function createDefaultPreference(overrides = {}) {
  return {
    ...DEFAULT_PREFERENCE,
    ...overrides,
    categoryWeights: {
      ...DEFAULT_PREFERENCE.categoryWeights,
      ...(overrides.categoryWeights || {}),
    },
  };
}
