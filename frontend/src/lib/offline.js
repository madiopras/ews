// Lightweight offline cache on top of localStorage.
const PREFIX = "sumut_cache_";

export function cacheSet(key, data) {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function privateKey(userId, key) {
  if (!userId) throw new Error("Private cache requires a user id");
  return `private_${userId}_${key}`;
}

export function privateCacheSet(userId, key, data) {
  cacheSet(privateKey(userId, key), data);
}

export function privateCacheGet(userId, key) {
  return cacheGet(privateKey(userId, key));
}

export function clearPrivateCache(userId) {
  if (!userId) return;
  const scopedPrefix = PREFIX + `private_${userId}_`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(scopedPrefix)) localStorage.removeItem(key);
  }
}

const ACCOUNT_SESSION_KEYS = [
  "planner_draft_v2",
  "auth_next",
  "auth_intent",
  "pending_review_destination",
  "ews.analytics-session.v1",
];

export function clearAccountSession(userId) {
  clearPrivateCache(userId);
  try {
    ACCOUNT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* browser storage unavailable */
  }
}
