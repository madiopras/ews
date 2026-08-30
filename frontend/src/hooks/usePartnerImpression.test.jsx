import React, { act } from "react";
import { createRoot } from "react-dom/client";
import usePartnerImpression from "./usePartnerImpression.js";
import { trackPartnerEvent } from "../lib/partnerAnalytics.js";

jest.mock("../lib/partnerAnalytics.js", () => ({ trackPartnerEvent: jest.fn() }));

function Subject() {
  const ref = usePartnerImpression({
    partnerId: "partner-1",
    source: "planner",
    destinationId: "dest-1",
    analyticsContext: {
      placement: "organic",
      relevance_score: 70,
      match_factor_codes: ["destination_coverage", "requested_service_type"],
    },
  });
  return <article ref={ref}>Partner</article>;
}

describe("usePartnerImpression", () => {
  let container;
  let root;
  let observerCallback;
  let disconnect;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    trackPartnerEvent.mockReset();
    disconnect = jest.fn();
    global.IntersectionObserver = jest.fn((callback) => {
      observerCallback = callback;
      return { observe: jest.fn(), disconnect };
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete global.IntersectionObserver;
  });

  test("tracks once only after at least half of the card enters the viewport", () => {
    act(() => root.render(<Subject />));
    act(() => observerCallback([{ isIntersecting: true, intersectionRatio: 0.49 }]));
    expect(trackPartnerEvent).not.toHaveBeenCalled();

    act(() => observerCallback([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    expect(trackPartnerEvent).toHaveBeenCalledTimes(1);
    expect(trackPartnerEvent).toHaveBeenCalledWith(
      "ai_impression",
      "partner-1",
      "planner",
      "dest-1",
      {
        placement: "organic",
        relevance_score: 70,
        match_factor_codes: ["destination_coverage", "requested_service_type"],
      },
    );
    expect(disconnect).toHaveBeenCalled();

    act(() => observerCallback([{ isIntersecting: true, intersectionRatio: 1 }]));
    expect(trackPartnerEvent).toHaveBeenCalledTimes(1);
  });
});
