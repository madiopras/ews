import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LlmProfileFormPage, { buildLlmProfilePayload } from "./LlmProfileFormPage.jsx";
import { LanguageProvider } from "../../../contexts/LanguageContext.jsx";
import * as settingsApi from "./settingsApi.js";

jest.mock("react-router/dom", () => ({
  HydratedRouter: () => null,
  RouterProvider: () => null,
}), { virtual: true });
jest.mock("./settingsApi.js", () => ({
  getLlmProfile: jest.fn(),
  listLlmProfiles: jest.fn(),
  createLlmProfile: jest.fn(),
  updateLlmProfile: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe("LlmProfileFormPage generation & failover controls", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    settingsApi.listLlmProfiles.mockResolvedValue([
      { id: "prof-1", name: "Primary GPT", model_name: "gpt-4.1-mini", enabled: true },
      { id: "prof-2", name: "Backup DeepSeek", model_name: "deepseek-chat", enabled: true },
    ]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  test("normalizes optional JSON mode, temperature, max_tokens, and fallback_profile_id payload", () => {
    expect(buildLlmProfilePayload({
      name: "Primary",
      base_url: "https://api.example.com/v1",
      model_name: "gpt-4.1-mini",
      enabled: true,
      api_key: "sk-123",
      supports_json_mode: true,
      temperature: "0.35",
      max_tokens: "4096",
      fallback_profile_id: "prof-2",
    }, false)).toEqual({
      name: "Primary",
      base_url: "https://api.example.com/v1",
      model_name: "gpt-4.1-mini",
      enabled: true,
      api_key: "sk-123",
      supports_json_mode: true,
      temperature: 0.35,
      max_tokens: 4096,
      fallback_profile_id: "prof-2",
    });

    expect(buildLlmProfilePayload({
      name: "Primary",
      base_url: "https://api.example.com/v1",
      model_name: "gpt-4.1-mini",
      enabled: true,
      api_key_action: "preserve",
      api_key: "",
      supports_json_mode: false,
      temperature: "",
      max_tokens: "",
      fallback_profile_id: "",
    }, true)).toEqual({
      name: "Primary",
      base_url: "https://api.example.com/v1",
      model_name: "gpt-4.1-mini",
      enabled: true,
      api_key_action: "preserve",
      api_key: null,
      supports_json_mode: false,
      temperature: null,
      max_tokens: null,
      fallback_profile_id: null,
    });
  });

  test("loads existing values in edit mode and excludes the profile itself from fallback dropdown", async () => {
    settingsApi.getLlmProfile.mockResolvedValue({
      id: "prof-1",
      name: "Primary GPT",
      base_url: "https://api.example.com/v1",
      model_name: "gpt-4.1-mini",
      enabled: true,
      active: false,
      supports_json_mode: true,
      temperature: 0.4,
      max_tokens: 4096,
      fallback_profile_id: "prof-2",
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/admin/settings/llm/prof-1/edit"]}>
            <LanguageProvider>
              <Routes>
                <Route path="/admin/settings/llm/:id/edit" element={<LlmProfileFormPage />} />
              </Routes>
            </LanguageProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.querySelector('[data-testid="llm-supports-json-mode"]').checked).toBe(true);
    expect(document.querySelector('[data-testid="llm-temperature"]').value).toBe("0.4");
    expect(document.querySelector('[data-testid="llm-max-tokens"]').value).toBe("4096");
    const select = document.querySelector('[data-testid="llm-fallback-profile"]');
    expect(select.value).toBe("prof-2");
    const optionValues = Array.from(select.options).map((opt) => opt.value);
    expect(optionValues).toContain("prof-2");
    expect(optionValues).not.toContain("prof-1");
  });
});
