import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { api } from "../lib/api.js";

jest.mock("../lib/api.js", () => ({
  api: { get: jest.fn(), post: jest.fn() },
  formatError: (value) => String(value || "Error"),
}));

function Probe() {
  const { ready, user, login } = useAuth();
  return <div>
    <span data-testid="identity">{ready ? (user?.id || "guest") : "checking"}</span>
    <button type="button" onClick={() => login("a@example.com", "password")}>Login A</button>
    <button type="button" onClick={() => login("b@example.com", "password")}>Login B</button>
  </div>;
}

describe("guest continuity and account switching", () => {
  let root;
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    api.get.mockRejectedValue(new Error("guest"));
    api.post.mockImplementation((_url, payload) => Promise.resolve({
      data: { id: payload.email.startsWith("a") ? "user-a" : "user-b", email: payload.email, role: "user" },
    }));
  });
  afterEach(async () => { await act(async () => root.unmount()); jest.clearAllMocks(); });

  test("keeps the Guest planner draft through authentication, then clears it on account switch", async () => {
    sessionStorage.setItem("planner_draft_v2", JSON.stringify({ output: "Guest plan" }));
    await act(async () => { root.render(<AuthProvider><Probe /></AuthProvider>); await Promise.resolve(); });
    await act(async () => document.querySelectorAll("button")[0].click());
    expect(document.querySelector('[data-testid="identity"]').textContent).toBe("user-a");
    expect(sessionStorage.getItem("planner_draft_v2")).toContain("Guest plan");

    await act(async () => document.querySelectorAll("button")[1].click());
    expect(document.querySelector('[data-testid="identity"]').textContent).toBe("user-b");
    expect(sessionStorage.getItem("planner_draft_v2")).toBeNull();
  });
});
