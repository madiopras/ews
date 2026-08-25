import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PlannerWizard from "./PlannerWizard.jsx";

const t = {
  planner: { preferredDestination: "Destinasi pilihan", removePreferred: "Hapus" },
  categories: { nature: "Alam", culinary: "Kuliner", adventure: "Petualangan", beach: "Pantai", camping: "Berkemah", culture: "Budaya", hotel: "Hotel", hotspring: "Air Panas", island: "Pulau", lake: "Danau", mountain: "Gunung", tea: "Teh", viewpoint: "Titik Pandang", waterfall: "Air Terjun" },
};
const handlers = {
  onStoryChange: jest.fn(), onStorySubmit: jest.fn(), onDaysChange: jest.fn(), onStyleChange: jest.fn(), onInterestToggle: jest.fn(), onBasicsSubmit: jest.fn(), onInterestsSubmit: jest.fn(), onBack: jest.fn(), onRemovePreferred: jest.fn(),
};
const form = { days: null, budget_style: null, interests: [], extra_context: "", preferred_destination_ids: [] };

describe("PlannerWizard", () => {
  let root;
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });
  afterEach(async () => { await act(async () => root.unmount()); });

  test("renders the story input as the primary first step", async () => {
    await act(async () => { root.render(<PlannerWizard step="story" form={form} lang="id" t={t} {...handlers} />); });
    expect(document.querySelector('[data-testid="planner-wizard-story"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="planner-wizard-basics"]')).toBeNull();
  });

  test("renders only the requested conditional wizard step", async () => {
    await act(async () => { root.render(<PlannerWizard step="interests" form={{ ...form, days: 3, budget_style: "mid_range" }} lang="id" t={t} {...handlers} />); });
    expect(document.querySelector('[data-testid="planner-wizard-interests"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="planner-wizard-basics"]')).toBeNull();
    expect(document.activeElement?.tagName).toBe("H2");
  });

  test("shows an accessible loading state during wizard transitions", async () => {
    await act(async () => { root.render(<PlannerWizard step="basics" transitioning transitionMessage="Menyiapkan" form={form} lang="id" t={t} {...handlers} />); });
    expect(document.querySelector('[data-testid="planner-wizard-transition"]')).not.toBeNull();
    expect(document.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
  });

  test("switches language without losing the current answers", async () => {
    const selected = { ...form, days: 4, budget_style: "luxury" };
    await act(async () => { root.render(<PlannerWizard step="basics" form={selected} lang="id" t={t} {...handlers} />); });
    expect(document.querySelector('[data-testid="planner-days"]').value).toBe("4");
    expect(document.body.textContent).toContain("Mewah");

    await act(async () => { root.render(<PlannerWizard step="basics" form={selected} lang="en" t={t} {...handlers} />); });
    expect(document.querySelector('[data-testid="planner-days"]').value).toBe("4");
    expect(document.body.textContent).toContain("Luxury");
  });
});
