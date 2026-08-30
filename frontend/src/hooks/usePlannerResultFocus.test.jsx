import React, { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import usePlannerResultFocus from "./usePlannerResultFocus.js";

function Harness() {
  const [revision, setRevision] = useState(0);
  const headingRef = useRef(null);
  usePlannerResultFocus(headingRef, revision);
  return <><button type="button" onClick={() => setRevision((value) => value + 1)}>Complete</button><h2 ref={headingRef} tabIndex={-1}>Itinerary Anda</h2></>;
}

test("moves focus to the result heading after generation completes", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const originalRequest = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  window.requestAnimationFrame = (callback) => { callback(); return 1; };
  window.cancelAnimationFrame = jest.fn();
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById("root"));
  await act(async () => root.render(<Harness />));
  expect(document.activeElement.tagName).not.toBe("H2");
  await act(async () => document.querySelector("button").click());
  expect(document.activeElement).toBe(document.querySelector("h2"));
  await act(async () => root.unmount());
  window.requestAnimationFrame = originalRequest;
  window.cancelAnimationFrame = originalCancel;
});
