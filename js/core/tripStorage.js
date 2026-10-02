const STORAGE_KEY = 'teum.trips.v1';

function storageAvailable() {
  try { return typeof localStorage !== 'undefined'; } catch { return false; }
}

function safeRead() {
  if (!storageAvailable()) return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not_array');
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function write(items) {
  if (!storageAvailable()) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return true;
}

export function listTrips({ ownerUserId } = {}) {
  const items = safeRead();
  if (ownerUserId === undefined) return items;
  return items.filter((item) => item.ownerUserId === ownerUserId);
}

export function saveTrip({ plannerInput, plan, ownerUserId = null }) {
  const items = safeRead();
  const id = `trip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const trip = { id, ownerUserId, createdAt: new Date().toISOString(), plannerInput, plan };
  items.unshift(trip);
  write(items);
  return trip;
}

export function deleteTrip(id) {
  const items = safeRead();
  const next = items.filter((item) => item.id !== id);
  write(next);
  return next.length !== items.length;
}

export function getTrip(id) {
  return safeRead().find((item) => item.id === id) || null;
}


export function deleteTripsByOwner(ownerUserId) {
  const items = safeRead();
  const next = items.filter((item) => item.ownerUserId !== ownerUserId);
  write(next);
  return items.length - next.length;
}

export function clearTrips() {
  if (storageAvailable()) localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY as TRIP_STORAGE_KEY };
