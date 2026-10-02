import { placeProvider as dev1PlaceProvider } from '../api/tourApi.js';

/**
 * Dev1 TourAPI adapter for Dev2 recommendation.
 * Keeps the shared Place contract and makes food/lodging discovery location-based,
 * because Dev2 passes lat/lng/radius rather than administrative region codes.
 */
export const placeProvider = Object.freeze({
  ...dev1PlaceProvider,
  getFoodCandidates(params = {}, options = {}) {
    return dev1PlaceProvider.getNearbyPlaces({ ...params, type: 'food' }, options);
  },
  getLodgingCandidates(params = {}, options = {}) {
    return dev1PlaceProvider.getNearbyPlaces({ ...params, type: 'lodging' }, options);
  },
});
