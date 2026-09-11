import {
  PLANNER_DRAFT_KEY,
  PLANNER_DRAFT_MAX_AGE_MS,
  PLANNER_DRAFT_SCHEMA_VERSION,
  clearPlannerDraft,
  consumePlannerAutoStart,
  createHomePlannerHandoff,
  readPlannerDraft,
  writePlannerDraft,
} from "./plannerDraft.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe("Planner draft handoff contract", () => {
  test("creates a versioned one-shot handoff from a trimmed Home prompt", () => {
    const storage = memoryStorage();
    const draft = createHomePlannerHandoff("  Liburan 3 hari yang nyaman dan suka alam  ", storage, 1000);

    expect(draft).toMatchObject({
      schemaVersion: PLANNER_DRAFT_SCHEMA_VERSION,
      savedAt: 1000,
      form: {
        extra_context: "Liburan 3 hari yang nyaman dan suka alam",
        days: null,
        budget_style: null,
        interests: [],
      },
      handoff: {
        source: "home",
        autoStart: true,
        consumedAt: null,
      },
    });
    expect(draft.handoff.id).toEqual(expect.any(String));
    expect(JSON.parse(storage.getItem(PLANNER_DRAFT_KEY))).toEqual(draft);
  });

  test("consumes a matching Home handoff only once", () => {
    const storage = memoryStorage();
    const created = createHomePlannerHandoff("3 hari nyaman, alam dan kuliner", storage, 1000);

    const consumed = consumePlannerAutoStart(created.handoff.id, storage, 1100);

    expect(consumed.handoff).toMatchObject({
      id: created.handoff.id,
      autoStart: false,
      consumedAt: 1100,
    });
    expect(consumePlannerAutoStart(created.handoff.id, storage, 1200)).toBeNull();
  });

  test("does not consume a mismatched handoff", () => {
    const storage = memoryStorage();
    const created = createHomePlannerHandoff("Trip keluarga", storage, 1000);

    expect(consumePlannerAutoStart("another-handoff", storage, 1100)).toBeNull();
    expect(readPlannerDraft(storage, 1100).handoff).toEqual(created.handoff);
  });

  test("rejects empty, malformed, and expired drafts", () => {
    const storage = memoryStorage();
    expect(createHomePlannerHandoff("   ", storage, 1000)).toBeNull();

    storage.setItem(PLANNER_DRAFT_KEY, "not-json");
    expect(readPlannerDraft(storage, 1000)).toBeNull();

    writePlannerDraft({ form: { extra_context: "Trip lama" } }, storage, 1000);
    expect(readPlannerDraft(storage, 1000 + PLANNER_DRAFT_MAX_AGE_MS + 1)).toBeNull();
  });

  test("clears the stored draft", () => {
    const storage = memoryStorage();
    writePlannerDraft({ form: { extra_context: "Trip" } }, storage, 1000);
    clearPlannerDraft(storage);
    expect(storage.getItem(PLANNER_DRAFT_KEY)).toBeNull();
  });
});
