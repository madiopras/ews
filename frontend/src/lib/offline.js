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
