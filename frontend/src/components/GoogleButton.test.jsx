import React, { act } from "react";
import { createRoot } from "react-dom/client";
import GoogleButton from "./GoogleButton.jsx";
import { api } from "../lib/api.js";
import { renderGoogleIdentityButton } from "../lib/googleIdentity.js";

const mockSetUser = jest.fn();
const mockNavigate = jest.fn();
let credentialHandler;

jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ setUser: mockSetUser }),
}));
jest.mock("../contexts/LanguageContext.jsx", () => ({
  useLang: () => ({
    t: {
      common: { loading: "Memuat" },
      auth: {
        signingIn: "Menyiapkan akun",
        googleFailed: "Login Google gagal",
        googleUnavailable: "Login Google tidak tersedia",
        intentFailed: "Aksi gagal dipulihkan",
      },
    },
  }),
}));
jest.mock("../lib/api.js", () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../lib/googleIdentity.js", () => ({ renderGoogleIdentityButton: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

describe("GoogleButton direct GIS flow", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    credentialHandler = null;
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root"));
    api.get.mockResolvedValue({ data: { enabled: true, client_id: "public-client.apps.googleusercontent.com" } });
    api.post.mockResolvedValue({ data: { id: "user-1", email: "user@example.com", role: "user" } });
    renderGoogleIdentityButton.mockImplementation(async (element, clientId, handler) => {
      credentialHandler = handler;
      element.textContent = `Google:${clientId}`;
      return jest.fn();
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks();
  });

  test("loads public config and exchanges only the Google credential", async () => {
    const authEvent = jest.fn();
    window.addEventListener("app-auth-success", authEvent);
    await act(async () => {
      root.render(<GoogleButton next="/profile" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.get).toHaveBeenCalledWith("/auth/google/config");
    expect(renderGoogleIdentityButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "public-client.apps.googleusercontent.com",
      expect.any(Function),
    );

    await act(async () => credentialHandler({ credential: "signed-google-id-token" }));
    expect(api.post).toHaveBeenCalledWith("/auth/google", { credential: "signed-google-id-token" });
    expect(mockSetUser).toHaveBeenCalledWith({ id: "user-1", email: "user@example.com", role: "user" });
    expect(authEvent).toHaveBeenCalledTimes(1);
    window.removeEventListener("app-auth-success", authEvent);
  });

  test("shows a localized unavailable state when GIS is disabled", async () => {
    api.get.mockResolvedValue({ data: { enabled: false, client_id: "" } });
    await act(async () => {
      root.render(<GoogleButton />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain("Login Google tidak tersedia");
    expect(renderGoogleIdentityButton).not.toHaveBeenCalled();
  });
});
