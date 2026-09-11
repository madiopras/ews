import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import Planner from "./Planner.jsx";
import { createHomePlannerHandoff, writePlannerDraft } from "../lib/plannerDraft.js";
import { api } from "../lib/api.js";

jest.mock("react-router/dom", () => ({ HydratedRouter: () => null, RouterProvider: () => null }), { virtual: true });
jest.mock("../lib/api.js", () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../lib/markdown.jsx", () => ({ renderMarkdown: () => null }));
jest.mock("../contexts/LanguageContext.jsx", () => ({
  useLang: () => ({
    lang: "id",
    t: {
      home: { plannerTitle: "Rencanakan perjalananmu dengan AI." },
      planner: {
        title: "AI Trip Planner",
        subtitle: "Susun perjalanan",
        tagline: "Rencanakan liburan sempurna",
        itineraryTitle: "Itinerary Anda",
        resultActions: "Aksi itinerary",
        editPreferences: "Ubah preferensi",
        regenerate: "Acak ulang",
        invalidDestination: "Destinasi tidak tersedia",
        outOfScope: "Di luar cakupan",
        startError: "Planner gagal dimulai",
        connectionInterrupted: "Koneksi terputus",
        generationCancelled: "Pembuatan dibatalkan",
      },
      categories: { nature: "Alam" },
      savedTrips: { loadError: "Rencana gagal dimuat", saveBtn: "Simpan", saved: "Tersimpan", titlePlaceholder: "Judul perjalanan" },
      common: { saveError: "Gagal menyimpan" },
    },
  }),
}));
jest.mock("../contexts/AuthContext.jsx", () => ({ useAuth: () => ({ user: false }) }));
jest.mock("../components/Seo.jsx", () => () => null);
jest.mock("../components/UlosPattern.jsx", () => () => null);
jest.mock("../components/Planner/PlannerWizard.jsx", () => {
  const ReactModule = require("react");
  return ({ step, transitioning, form }) => ReactModule.createElement("div", {
    "data-testid": "planner-wizard-mock",
    "data-step": step,
    "data-transitioning": String(Boolean(transitioning)),
    "data-story": form.extra_context,
  });
});
jest.mock("../components/Planner/PlannerResultGate.jsx", () => ({ children }) => children);
jest.mock("../components/Planner/PlannerResultCards.jsx", () => () => null);
jest.mock("../components/Planner/StructuredPlannerResult.jsx", () => ({
  __esModule: true,
  default: () => null,
  PlannerGenerationError: () => null,
  PlannerResultProgress: () => null,
}));
jest.mock("../hooks/usePlannerResultFocus.js", () => () => {});
jest.mock("../lib/partnerAnalytics.js", () => ({ trackPlannerEvent: jest.fn() }));
jest.mock("../lib/plannerStreamContract.js", () => {
  const actual = jest.requireActual("../lib/plannerStreamContract.js");
  return {
    ...actual,
    consumePlannerSseStream: jest.fn(async () => ({ completed: true })),
  };
});

describe("Planner Home handoff auto-start", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    sessionStorage.clear();
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    api.get.mockResolvedValue({ data: {} });
    global.fetch = jest.fn(async () => ({ ok: true, body: {} }));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  async function renderPlanner(strict = false) {
    const content = <MemoryRouter initialEntries={["/planner"]}><Planner /></MemoryRouter>;
    await act(async () => {
      root.render(strict ? <React.StrictMode>{content}</React.StrictMode> : content);
      await Promise.resolve();
    });
  }

  async function finishTransitions() {
    for (let step = 0; step < 4; step += 1) {
      await act(async () => {
        jest.runOnlyPendingTimers();
        await Promise.resolve();
      });
    }
  }

  test("generates a complete Home prompt once under Strict Mode", async () => {
    createHomePlannerHandoff("Liburan 3 hari yang nyaman, suka alam dan kuliner");

    await renderPlanner(true);
    await finishTransitions();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const request = global.fetch.mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      days: 3,
      budget_style: "mid_range",
      interests: ["culinary", "nature"],
      extra_context: "Liburan 3 hari yang nyaman, suka alam dan kuliner",
    });
    expect(JSON.parse(sessionStorage.getItem("planner_draft_v2")).handoff.autoStart).toBe(false);
  });

  test("opens the first missing step for a partial Home prompt", async () => {
    createHomePlannerHandoff("Liburan keluarga sambil menikmati kuliner Medan");

    await renderPlanner();
    await finishTransitions();

    const wizard = document.querySelector('[data-testid="planner-wizard-mock"]');
    expect(wizard.getAttribute("data-step")).toBe("basics");
    expect(wizard.getAttribute("data-story")).toBe("Liburan keluarga sambil menikmati kuliner Medan");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("keeps a direct Planner visit on the manual story step", async () => {
    await renderPlanner();
    await finishTransitions();

    const wizard = document.querySelector('[data-testid="planner-wizard-mock"]');
    expect(wizard.getAttribute("data-step")).toBe("story");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("shows one result action bar and returns to preferences without covering the mobile navigation", async () => {
    writePlannerDraft({
      form: {
        days: 3,
        budget_style: "mid_range",
        interests: ["nature"],
        extra_context: "Liburan alam tiga hari",
        preferred_destination_ids: [],
      },
      output: "Rencana perjalanan siap",
      recommendations: [],
      destinationIds: [],
      wizard: { step: "result", trail: [] },
      result: null,
      resultFormat: "legacy",
    });

    await renderPlanner();
    await finishTransitions();

    const actions = document.querySelector('[data-testid="planner-result-actions"]');
    expect(actions).not.toBeNull();
    expect(actions.getAttribute("class")).toContain("bottom-[calc(5rem+");
    expect(actions.querySelectorAll("button")).toHaveLength(3);
    expect(document.querySelector('[data-testid="planner-wizard-mock"]')).toBeNull();

    await act(async () => {
      Array.from(actions.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Ubah preferensi"))
        .click();
    });

    expect(document.querySelector('[data-testid="planner-result-actions"]')).toBeNull();
    expect(document.querySelector('[data-testid="planner-wizard-mock"]')).not.toBeNull();
  });
});
