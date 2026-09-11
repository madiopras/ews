export const PLANNER_DRAFT_KEY = "planner_draft_v2";
export const PLANNER_DRAFT_SCHEMA_VERSION = 4;
export const PLANNER_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function defaultStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function handoffId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function readPlannerDraft(storage = defaultStorage(), now = Date.now()) {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(PLANNER_DRAFT_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.savedAt) || now - parsed.savedAt > PLANNER_DRAFT_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePlannerDraft(draft, storage = defaultStorage(), now = Date.now()) {
  if (!storage) return null;
  const stored = {
    ...draft,
    schemaVersion: PLANNER_DRAFT_SCHEMA_VERSION,
    savedAt: now,
  };
  storage.setItem(PLANNER_DRAFT_KEY, JSON.stringify(stored));
  return stored;
}

export function createHomePlannerHandoff(prompt, storage = defaultStorage(), now = Date.now()) {
  const extraContext = String(prompt || "").trim();
  if (!extraContext) return null;

  return writePlannerDraft({
    form: {
      days: null,
      budget_style: null,
      interests: [],
      extra_context: extraContext,
      preferred_destination_ids: [],
    },
    output: "",
    recommendations: [],
    destinationIds: [],
    wizard: { step: "story", trail: [] },
    result: null,
    resultFormat: "legacy",
    handoff: {
      id: handoffId(),
      source: "home",
      autoStart: true,
      consumedAt: null,
    },
  }, storage, now);
}

export function consumePlannerAutoStart(id, storage = defaultStorage(), now = Date.now()) {
  const draft = readPlannerDraft(storage, now);
  if (!draft?.handoff?.autoStart || !id || draft.handoff.id !== id) return null;

  return writePlannerDraft({
    ...draft,
    handoff: {
      ...draft.handoff,
      autoStart: false,
      consumedAt: now,
    },
  }, storage, now);
}

export function clearPlannerDraft(storage = defaultStorage()) {
  storage?.removeItem(PLANNER_DRAFT_KEY);
}
