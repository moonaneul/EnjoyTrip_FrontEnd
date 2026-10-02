import assert from 'node:assert/strict';
import { placeProvider } from '../js/integration/placeProvider.js';
import { createDefaultPreference } from '../js/features/preferences/defaultPreference.js';
import { normalizePreference } from '../js/features/preferences/preferenceSchema.js';
import { resolvePreference } from '../js/features/preferences/preferenceResolver.js';
import { scorePlacePreference } from '../js/features/preferences/preferenceScoring.js';
import { buildPersonalizedStrategies } from '../js/features/recommendation/personalizedStrategies.js';
import { saveUserPreference, getUserPreference, deleteUserPreference } from '../js/features/preferences/preferenceStorage.js';

const REQUIRED_PROVIDER_METHODS = [
  'getRegions','getSubregions','searchPlaces','getNearbyPlaces','getPlaceDetail','getFoodCandidates','getLodgingCandidates',
];
for (const method of REQUIRED_PROVIDER_METHODS) assert.equal(typeof placeProvider[method], 'function', `missing ${method}`);

const neutral = createDefaultPreference();
assert.equal(neutral.categoryWeights.nature, 0.5);
const normalized = normalizePreference({ pace:2, travelTolerance:'???', categoryWeights:{ culture:0.9 } });
assert.equal(normalized.pace, 1);
assert.equal(normalized.travelTolerance, 'medium');
assert.equal(normalized.categoryWeights.culture, 0.9);

const userPreference = normalizePreference({
  completed:true,
  categoryWeights:{ nature:0.8, food:0.4, cafe:0.5, culture:0.9, history:0.7, shopping:0.2, photo:0.5, local:0.6, activity:0.4 },
});
const effective = resolvePreference({ userPreference, tripContext:{ moods:['카페'] } });
assert.ok(effective.categoryWeights.cafe > userPreference.categoryWeights.cafe);
assert.equal(effective.source, 'user');

const cultureScore = scorePlacePreference({ type:'culture', title:'광주 현대 미술관' }, effective, { distanceM:2000 });
const shoppingScore = scorePlacePreference({ type:'shopping', title:'대형 쇼핑몰' }, effective, { distanceM:2000 });
assert.ok(cultureScore > shoppingScore, 'culture preference should rank culture above shopping');

const relaxedPreference = resolvePreference({
  userPreference: {
    ...userPreference,
    completed:true,
    pace:0.15,
    restImportance:0.9,
    categoryWeights:{ ...userPreference.categoryWeights, cafe:0.9, culture:0.9, local:0.85 },
  },
  tripContext:{ moods:[] },
});
const relaxedStrategies = buildPersonalizedStrategies(relaxedPreference, {});
assert.equal(relaxedStrategies.length, 3);
assert.equal(relaxedStrategies.every((strategy)=>strategy.mode === 'relaxed'), true, 'relaxed survey must keep all three recommendations relaxed');
assert.equal(relaxedStrategies.some((strategy)=>strategy.label.includes('빽빽')), false, 'personalized choices must not expose fixed packed-plan labels');
assert.equal(relaxedStrategies.some((strategy)=>strategy.label.includes('랜덤')), false, 'personalized choices must not expose fixed random-plan labels');
assert.equal(new Set(relaxedStrategies.map((strategy)=>strategy.label)).size, 3, 'three personalized strategies need distinct labels');

class MemoryStorage {
  constructor(){ this.map = new Map(); }
  getItem(key){ return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key,value){ this.map.set(key,String(value)); }
  removeItem(key){ this.map.delete(key); }
}
globalThis.localStorage = new MemoryStorage();
const savedPreference = saveUserPreference('u1', { ...userPreference, completed:true });
assert.equal(getUserPreference('u1').categoryWeights.culture, savedPreference.categoryWeights.culture);
assert.equal(deleteUserPreference('u1'), true);
assert.equal(getUserPreference('u1'), null);

console.log('Integration preference/provider tests passed');
