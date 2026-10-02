import { getCurrentUser } from '../core/authStorage.js';

// Integration policy: preserve the existing guest-save behavior while preventing
// one signed-in user from seeing another user's saved trips in the same browser.
export const ALLOW_GUEST_TRIP_SAVE = true;

export function currentTripOwnerId() {
  return getCurrentUser()?.id ?? null;
}

export function visibleTripOwnerId() {
  return getCurrentUser()?.id ?? null;
}
