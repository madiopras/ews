export function safeNextPath(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return fallback;
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (["/login", "/register"].includes(parsed.pathname)) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

export function authUrl(route, nextPath, intent = "") {
  const params = new URLSearchParams();
  params.set("next", safeNextPath(nextPath));
  if (intent) params.set("intent", intent);
  return `${route}?${params.toString()}`;
}

export async function resumeAuthIntent(intent, apiClient) {
  if (!intent || !apiClient) return;
  const [type, targetId] = intent.split(":", 2);
  if (!targetId) return;
  if (type === "wishlist") {
    await apiClient.post(`/wishlist/${encodeURIComponent(targetId)}`);
  }
  if (type === "review") {
    sessionStorage.setItem("pending_review_destination", targetId);
  }
}

export function localizedAuthError(message, translations) {
  const value = String(message || "").toLowerCase();
  if (value.includes("invalid email or password")) return translations.invalidCredentials;
  if (value.includes("account is inactive")) return translations.accountInactive;
  if (value.includes("email already registered")) return translations.emailRegistered;
  if (value.includes("terms and privacy")) return translations.consentRequired;
  if (value.includes("too many")) return translations.tooManyAttempts;
  if (value.includes("expired")) return translations.tokenExpired;
  if (value.includes("invalid token") || value.includes("newer link") || value.includes("already been used")) return translations.invalidToken;
  if (value.includes("password is incorrect")) return translations.passwordIncorrect;
  return message || translations.genericError;
}
