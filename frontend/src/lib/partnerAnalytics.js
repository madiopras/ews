import { api } from "./api.js";

export const ANALYTICS_CONSENT_KEY = "ews.analytics-consent.v1";
const SESSION_KEY = "ews.analytics-session.v1";

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll("-", "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function analyticsConsent() {
  try { return localStorage.getItem(ANALYTICS_CONSENT_KEY); } catch { return null; }
}

export function setAnalyticsConsent(value) {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent("analytics-consent-change", { detail: value }));
}

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = randomId();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export async function trackPartnerEvent(eventType, partnerId, source, destinationId = null) {
  if (analyticsConsent() !== "granted" || !partnerId) return false;
  try {
    await api.post("/analytics/partner-events", {
      event_id: randomId(),
      event_type: eventType,
      partner_id: partnerId,
      source,
      destination_id: destinationId,
      anonymous_session_id: sessionId(),
    }, { headers: { "X-Analytics-Consent": "granted" } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Track the planner funnel without sending the user's trip story or preferences.
 * The backend accepts only the event type, visible wizard step, and a pseudonymous
 * session identifier.
 */
export async function trackPlannerEvent(eventType, step) {
  if (analyticsConsent() !== "granted") return false;
  try {
    await api.post("/analytics/planner-events", {
      event_id: randomId(),
      event_type: eventType,
      step,
      anonymous_session_id: sessionId(),
    }, { headers: { "X-Analytics-Consent": "granted" } });
    return true;
  } catch {
    return false;
  }
}
