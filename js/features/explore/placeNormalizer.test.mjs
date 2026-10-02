import assert from 'node:assert/strict';
import { normalizePlace } from './placeNormalizer.js';
import { PLACE_FIXTURES } from './placeNormalizer.fixture.js';

const attraction = normalizePlace(PLACE_FIXTURES.attraction.raw, {
  intro: PLACE_FIXTURES.attraction.intro,
});
assert.equal(attraction.id, '126128');
assert.equal(attraction.type, 'attraction');
assert.equal(attraction.lat, 35.8826195757);
assert.equal(attraction.lng, 128.6506352387);
assert.equal(attraction.address, '대구광역시 동구 효목동 산 234-29');
assert.equal(attraction.overview.includes('<b>'), false);
assert.equal(attraction.openInfo.status, 'unknown');
assert.equal(attraction.openInfo.text, '상시 개방');
assert.equal(attraction.openInfo.restDate, '연중무휴');

const food = normalizePlace(PLACE_FIXTURES.foodWithoutImage.raw, {
  intro: PLACE_FIXTURES.foodWithoutImage.intro,
});
assert.equal(food.type, 'food');
assert.equal(food.imageUrl, null);
assert.equal(food.tel, null);
assert.equal(food.openInfo.text, '10:00~21:00');

const badCoord = normalizePlace(PLACE_FIXTURES.malformedCoordinates.raw);
assert.equal(badCoord.lat, null);
assert.equal(badCoord.lng, null);
assert.equal(badCoord.type, 'shopping');

console.log('placeNormalizer fixtures: PASS');
