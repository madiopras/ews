import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import TripPromptComposer from "./TripPromptComposer.jsx";

function ControlledComposer({ examples }) {
  const [value, setValue] = useState("");
  return (
    <form>
      <TripPromptComposer
        value={value}
        onChange={setValue}
        placeholder="Ceritakan perjalanan Anda"
        animatedPlaceholders={examples}
        submitLabel="Mulai"
        testIdPrefix="test-prompt"
      />
    </form>
  );
}

describe("TripPromptComposer animated placeholder", () => {
  let root;
  let originalMatchMedia;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    window.matchMedia = originalMatchMedia;
    jest.useRealTimers();
  });

  test("types while idle, pauses on focus, and disappears after user input", async () => {
    await act(async () => {
      root.render(<ControlledComposer examples={["Liburan keluarga"]} />);
    });

    const placeholder = () => document.querySelector('[data-testid="test-prompt-animated-placeholder"]');
    expect(placeholder().textContent).toContain("L");

    await act(async () => {
      jest.advanceTimersByTime(64);
    });
    expect(placeholder().textContent).toContain("Li");

    const input = document.querySelector('[data-testid="test-prompt-input"]');
    expect(input.className).toContain("text-base");
    expect(input.className).not.toContain("text-sm");
    await act(async () => input.focus());
    const pausedText = placeholder().textContent;
    await act(async () => jest.advanceTimersByTime(500));
    expect(placeholder().textContent).toBe(pausedText);

    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    await act(async () => {
      valueSetter.call(input, "Saya ingin ke Danau Toba");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(placeholder()).toBeNull();
  });

  test("shows a static first example when reduced motion is requested", async () => {
    window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    await act(async () => {
      root.render(<ControlledComposer examples={["Liburan keluarga", "Trip kuliner"]} />);
    });

    const placeholder = document.querySelector('[data-testid="test-prompt-animated-placeholder"]');
    expect(placeholder.textContent).toBe("Liburan keluarga");
    await act(async () => jest.advanceTimersByTime(5000));
    expect(placeholder.textContent).toBe("Liburan keluarga");
  });
});
