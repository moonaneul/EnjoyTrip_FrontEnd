const USERS_KEY = 'teum.users.v1';
const SESSION_KEY = 'teum.session.v1';

export class AuthStorageError extends Error {
  constructor(message, code = 'AUTH_STORAGE_ERROR') {
    super(message);
    this.name = 'AuthStorageError';
    this.code = code;
  }
}

function storage() {
  if (!globalThis.localStorage) {
    throw new AuthStorageError('LocalStorage를 사용할 수 없습니다.', 'STORAGE_UNAVAILABLE');
  }
  return globalThis.localStorage;
}

function safeParse(key, fallback) {
  const raw = storage().getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[AuthStorage] corrupted ${key}; reset`, error);
    storage().removeItem(key);
    return fallback;
  }
}

function save(key, value) {
  storage().setItem(key, JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function id() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function hashPassword(password) {
  if (!globalThis.crypto?.subtle) {
    throw new AuthStorageError('Web Crypto를 사용할 수 없습니다.', 'CRYPTO_UNAVAILABLE');
  }
  const bytes = new TextEncoder().encode(String(password));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function getUsers() {
  const users = safeParse(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

export function getSession() {
  const session = safeParse(SESSION_KEY, null);
  return session && typeof session === 'object' ? session : null;
}

export function clearSession() {
  storage().removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  const session = getSession();
  if (!session?.userId) return null;
  const user = getUsers().find((item) => item.id === session.userId) || null;
  if (!user) clearSession();
  return user;
}

export async function createUser({ email, password, nickname }) {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsers();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new AuthStorageError('이미 가입된 이메일입니다.', 'DUPLICATE_EMAIL');
  }

  const now = new Date().toISOString();
  const user = {
    id: id(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    nickname: String(nickname || '').trim(),
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  save(USERS_KEY, users);
  return { ...user, passwordHash: undefined };
}

export async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = getUsers().find((item) => item.email === normalizedEmail);
  if (!user) throw new AuthStorageError('이메일 또는 비밀번호가 올바르지 않습니다.', 'INVALID_CREDENTIALS');

  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.passwordHash) {
    throw new AuthStorageError('이메일 또는 비밀번호가 올바르지 않습니다.', 'INVALID_CREDENTIALS');
  }

  const session = {
    userId: user.id,
    createdAt: new Date().toISOString(),
  };
  save(SESSION_KEY, session);
  return { ...user, passwordHash: undefined };
}

export function logout() {
  clearSession();
}

export async function updateCurrentUser({ email, nickname }) {
  const session = getSession();
  if (!session?.userId) throw new AuthStorageError('로그인이 필요합니다.', 'NOT_AUTHENTICATED');

  const users = getUsers();
  const index = users.findIndex((item) => item.id === session.userId);
  if (index < 0) {
    clearSession();
    throw new AuthStorageError('사용자 정보를 찾을 수 없습니다.', 'USER_NOT_FOUND');
  }

  const normalizedEmail = normalizeEmail(email ?? users[index].email);
  const duplicate = users.some((user, userIndex) => userIndex !== index && user.email === normalizedEmail);
  if (duplicate) throw new AuthStorageError('이미 가입된 이메일입니다.', 'DUPLICATE_EMAIL');

  users[index] = {
    ...users[index],
    email: normalizedEmail,
    nickname: String(nickname ?? users[index].nickname).trim(),
    updatedAt: new Date().toISOString(),
  };
  save(USERS_KEY, users);
  return { ...users[index], passwordHash: undefined };
}

export async function resetPasswordDemo({ email, newPassword }) {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsers();
  const index = users.findIndex((item) => item.email === normalizedEmail);
  if (index < 0) throw new AuthStorageError('가입된 이메일을 찾을 수 없습니다.', 'USER_NOT_FOUND');

  users[index] = {
    ...users[index],
    passwordHash: await hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };
  save(USERS_KEY, users);
  return true;
}

export function deleteCurrentUser() {
  const session = getSession();
  if (!session?.userId) throw new AuthStorageError('로그인이 필요합니다.', 'NOT_AUTHENTICATED');

  const users = getUsers();
  const nextUsers = users.filter((item) => item.id !== session.userId);
  save(USERS_KEY, nextUsers);
  clearSession();
}

export const AUTH_STORAGE_KEYS = Object.freeze({ USERS_KEY, SESSION_KEY });
