import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider, useLang } from "./LanguageContext.jsx";

function Probe() {
  const { lang } = useLang();
  return <div data-testid="lang-probe">{lang}</div>;
}

test("admin public preview language query overrides preference without changing the saved preference", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem("lang", "id");
  window.history.pushState({}, "", "/destination/example?lang=en&preview=admin");
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById("root"));
  await act(async () => root.render(<LanguageProvider><Probe /></LanguageProvider>));
  expect(document.querySelector('[data-testid="lang-probe"]').textContent).toBe("en");
  expect(localStorage.getItem("lang")).toBe("id");
  await act(async () => root.unmount());
  window.history.pushState({}, "", "/");
  localStorage.clear();
});
