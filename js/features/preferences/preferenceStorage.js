import { normalizePreference } from './preferenceSchema.js';

const STORAGE_KEY = 'teum.user_preferences.v1';

function safeRead() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn('[PreferenceStorage] corrupted preference storage; reset', error);
    try { globalThis.localStorage?.removeItem(STORAGE_KEY); } catch {}
    return {};
  }
}

function write(value) {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getUserPreference(userId) {
  if (!userId) return null;
  const stored = safeRead()[userId];
  return stored ? normalizePreference(stored) : null;
}

export function hasCompletedPreference(userId) {
  return Boolean(getUserPreference(userId)?.completed);
}

export function saveUserPreference(userId, preference) {
  if (!userId) throw new Error('userId가 필요합니다.');
  const all = safeRead();
  const now = new Date().toISOString();
  const previous = all[userId];
  const normalized = normalizePreference({
    ...preference,
    completed: true,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  });
  all[userId] = normalized;
  write(all);
  return normalized;
}

export function deleteUserPreference(userId) {
  if (!userId) return false;
  const all = safeRead();
  if (!(userId in all)) return false;
  delete all[userId];
  write(all);
  return true;
}

export const PREFERENCE_STORAGE_KEY = STORAGE_KEY;
