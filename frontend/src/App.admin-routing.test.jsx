import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.js";
import { api } from "./lib/api.js";
import { createAppQueryClient } from "./lib/queryClient.js";

let mockAuthUser = { id: "admin-id", name: "Admin", email: "admin@example.com", role: "admin" };

// react-router-dom 7.18 CJS expects this entrypoint, while the repository's
// existing react-router resolution is 7.15. Browser builds use ESM and are not
// affected; this virtual adapter keeps Jest focused on the app routing itself.
jest.mock("react-router/dom", () => ({
  HydratedRouter: () => null,
  RouterProvider: () => null,
}), { virtual: true });

jest.mock("./components/Navbar.jsx", () => () => <div data-testid="main-navbar" />);
jest.mock("./components/BottomNav.jsx", () => () => <div data-testid="bottom-nav" />);
jest.mock("./components/AnalyticsConsent.jsx", () => () => null);
jest.mock("./pages/Home.jsx", () => () => <div />);
jest.mock("./pages/Directory.jsx", () => () => <div />);
jest.mock("./pages/DestinationDetail.jsx", () => () => <div />);
jest.mock("./pages/Login.jsx", () => () => <div />);
jest.mock("./pages/Register.jsx", () => () => <div />);
jest.mock("./pages/Wishlist.jsx", () => () => <div />);
jest.mock("./pages/Planner.jsx", () => () => <div />);
jest.mock("./pages/Partners.jsx", () => () => <div />);
jest.mock("./pages/PartnerDetail.jsx", () => () => <div data-testid="partner-public-detail-page" />);
jest.mock("./pages/PartnerRegister.jsx", () => () => <div />);
jest.mock("./pages/Profile.jsx", () => () => <div />);
jest.mock("./pages/PublicTrip.jsx", () => () => <div />);
jest.mock("./pages/mitra/MitraDashboard.jsx", () => () => <div data-testid="mitra-dashboard-page" />);
jest.mock("./pages/mitra/MitraOnboarding.jsx", () => () => <div data-testid="mitra-onboarding-page" />);
jest.mock("./pages/mitra/MitraBusiness.jsx", () => () => <div data-testid="mitra-business-page" />);
jest.mock("./features/admin/governance/GovernancePage.jsx", () => () => <div data-testid="governance-page" />);
jest.mock("./pages/Docs.jsx", () => () => <div />);

jest.mock("./contexts/AuthContext.jsx", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: mockAuthUser,
    ready: true,
    logout: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock("./lib/api.js", () => ({
  API: "http://localhost/api",
  formatError: (value) => String(value || "Error"),
  api: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

const responseFor = (url) => {
  if (url === "/experience/features") return {
    mitra_onboarding: { enabled: true, rollout_percentage: 100, reason: "full_rollout" },
    mitra_dashboard: { enabled: true, rollout_percentage: 100, reason: "existing_partner" },
  };
  if (url === "/admin/dashboard") {
    return {
      destinations: { active: 0, total: 0 },
      partners: { active: 0, pending: 0 },
      users: { active: 1, new_30d: 0 },
      itineraries: { total: 0 },
      planner: { requests_30d: 0, errors_30d: 0 },
      recent_activity: [],
    };
  }
  if (url === "/admin/settings") {
    return {
      site_name: "Explore Sumut",
      support_email: "admin@example.com",
      default_language: "id",
      maintenance_mode: false,
      partner_review_sla_days: 2,
      planner_enabled: true,
      backup_retention_days: 30,
    };
  }
  if (url === "/admin/settings/integrations") return {};
  if (url === "/admin/email-templates" || url === "/admin/backups") return { items: [], total: 0, page: 1, page_size: 25, pages: 0 };
  if (url === "/admin/llm-profiles") return [];
  if (url === "/admin/llm-profiles/runtime") return { source: "environment", profile_name: "Environment fallback", model_name: "test-model", enabled: true, configured: true, health_status: "unknown", latency_ms: null };
  if (url === "/admin/users") return {
    items: [{ id: "user-2", name: "User Test", email: "user@example.com", role: "user", account_active: true, auth_provider: "password", created_at: "2026-01-01T00:00:00+00:00", updated_at: "2026-01-01T00:00:00+00:00" }],
    total: 1, page: 1, page_size: 25, pages: 1,
  };
  if (url === "/admin/premium/plans") return {
    items: [{ id: "plan-1", code: "1m", label_id: "Unggulan 1 Bulan", label_en: "Featured 1 Month", months: 1, price: 99000, active: true, order: 1 }],
    total: 1, page: 1, page_size: 25, pages: 1,
  };
  if (url === "/admin/backups/status") return { directory_ready: true, format: "jsonl" };
  if (url === "/admin/audit-logs" || url === "/admin/ai-logs" || url === "/admin/system-logs") return { total: 0, items: [] };
  if (url === "/admin/destinations") return { items: [], total: 0, page: 1, page_size: 25, pages: 0 };
  if (url === "/admin/partners") return { items: [], total: 0, page: 1, page_size: 25, pages: 0 };
  if (url === "/admin/partners/507f1f77bcf86cd799439011") return {
    id: "507f1f77bcf86cd799439011",
    business_name: "Partner Test",
    type: "guide",
    whatsapp: "628123456789",
    description: "Partner test dengan deskripsi yang valid.",
    city: "Medan",
    email: "partner@example.com",
    address: "Medan",
    destination_ids: [],
    image: "",
    status: "pending",
    created_at: "2026-01-01T00:00:00+00:00",
    updated_at: "2026-01-01T00:00:00+00:00",
    is_premium: false,
    premium_until: null,
    is_active: true,
    verification_documents: [],
    approval_history: [],
  };
  if (url === "/destinations/admin" || url === "/partners/admin") return [];
  return [];
};

describe("admin shell routing", () => {
  let root;
  let testQueryClient;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockAuthUser = { id: "admin-id", name: "Admin", email: "admin@example.com", role: "admin" };
    localStorage.clear();
    document.body.innerHTML = '<div id="root"></div>';
    testQueryClient = createAppQueryClient();
    testQueryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
    api.get.mockImplementation((url) => Promise.resolve({ data: responseFor(url) }));
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
      root = null;
    }
    testQueryClient?.clear();
    jest.clearAllMocks();
  });

  const renderAt = async (path) => {
    window.history.pushState({}, "", path);
    root = createRoot(document.getElementById("root"));
    await act(async () => {
      root.render(<QueryClientProvider client={testQueryClient}><App /></QueryClientProvider>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  test("uses the dedicated admin shell without public navigation", async () => {
    await renderAt("/admin/dashboard");
    expect(document.querySelector('[data-testid="admin-layout"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="admin-dashboard"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="main-navbar"]')).toBeNull();
    expect(document.querySelector('[data-testid="bottom-nav"]')).toBeNull();
  });

  test("routes experience governance inside the admin shell", async () => {
    await renderAt("/admin/governance");
    expect(document.querySelector('[data-testid="admin-layout"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="governance-page"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Governance");
  });

  test("uses a dedicated partner shell without public or admin navigation", async () => {
    mockAuthUser = { id: "partner-id", name: "Partner", email: "partner@example.com", role: "partner" };
    await renderAt("/mitra");
    expect(document.querySelector('[data-testid="mitra-layout"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="mitra-dashboard-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="main-navbar"]')).toBeNull();
    expect(document.querySelector('[data-testid="bottom-nav"]')).toBeNull();
    expect(document.querySelector('[data-testid="admin-layout"]')).toBeNull();
  });

  test("routes approved partner management inside the dedicated partner shell", async () => {
    mockAuthUser = { id: "partner-id", name: "Partner", email: "partner@example.com", role: "partner" };
    await renderAt("/mitra/business/507f1f77bcf86cd799439011");
    expect(document.querySelector('[data-testid="mitra-layout"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="mitra-business-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="main-navbar"]')).toBeNull();
  });

  test("keeps the safe public partner detail in the public shell", async () => {
    mockAuthUser = null;
    await renderAt("/partners/507f1f77bcf86cd799439011");
    expect(document.querySelector('[data-testid="partner-public-detail-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="main-navbar"]')).not.toBeNull();
  });

  test("opens and closes the accessible mobile navigation drawer", async () => {
    await renderAt("/admin/dashboard");
    const openButton = document.querySelector('[aria-label="Buka navigasi admin"]');
    await act(async () => openButton.click());
    expect(document.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    const closeButton = document.querySelector('[aria-label="Tutup navigasi admin"]');
    await act(async () => closeButton.click());
    expect(document.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
  });

  test("closes mobile navigation with Escape and restores trigger focus", async () => {
    await renderAt("/admin/dashboard");
    const openButton = document.querySelector('[aria-label="Buka navigasi admin"]');
    await act(async () => openButton.click());
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
    expect(document.activeElement).toBe(openButton);
  });

  test("persists the collapsed desktop sidebar preference", async () => {
    await renderAt("/admin/dashboard");
    const collapseButton = document.querySelector('[aria-label="Ciutkan sidebar"]');
    await act(async () => collapseButton.click());
    expect(localStorage.getItem("admin_sidebar_collapsed")).toBe("true");
    expect(document.querySelector('[aria-label="Perluas sidebar"]')).not.toBeNull();
  });

  test("redirects the legacy membership route to users", async () => {
    await renderAt("/admin/membership");
    expect(window.location.pathname).toBe("/admin/users");
    expect(document.querySelector('[data-testid="user-list-page"]')).not.toBeNull();
  });

  test("preserves list URL state through browser back navigation", async () => {
    await renderAt("/admin/users?q=admin&role=admin&page=2");
    const plansLink = document.querySelector('a[href="/admin/plans"]');
    await act(async () => plansLink.click());
    expect(window.location.pathname).toBe("/admin/plans");
    await act(async () => {
      const navigated = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      window.history.back();
      await navigated;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(window.location.pathname).toBe("/admin/users");
    expect(window.location.search).toContain("q=admin");
    expect(window.location.search).toContain("role=admin");
  });

  test("switches all admin navigation labels to English", async () => {
    await renderAt("/admin/dashboard");
    const languageButton = document.querySelector('[aria-label="Ganti bahasa"]');
    await act(async () => languageButton.click());
    expect(localStorage.getItem("lang")).toBe("en");
    expect(document.body.textContent).toContain("Settings");
    expect(document.querySelector('[aria-label="Open admin navigation"]')).not.toBeNull();
  });

  test("redirects unauthenticated and non-admin users away from admin routes", async () => {
    mockAuthUser = null;
    await renderAt("/admin/dashboard");
    expect(window.location.pathname).toBe("/login");
    await act(async () => root.unmount());
    root = null;
    mockAuthUser = { id: "user-id", name: "User", email: "user@example.com", role: "user" };
    await renderAt("/admin/settings/llm");
    expect(window.location.pathname).toBe("/");
  });

  test("keeps settings subsection in the URL", async () => {
    await renderAt("/admin/settings/backups");
    expect(window.location.pathname).toBe("/admin/settings/backups");
    expect(document.querySelector('[data-testid="backup-list-page"]')).not.toBeNull();
  });

  test("keeps logs subsection in the URL", async () => {
    await renderAt("/admin/logs/system");
    expect(window.location.pathname).toBe("/admin/logs/system");
    expect(document.querySelector('[data-testid="system-log-list-page"]')).not.toBeNull();
  });

  test("renders the LLM settings route without exposing a secret field in the list", async () => {
    await renderAt("/admin/settings/llm");
    expect(document.querySelector('[data-testid="llm-profile-list-page"]')).not.toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  test("renders the standalone destination list route", async () => {
    await renderAt("/admin/destinations?q=toba");
    expect(document.querySelector('[data-testid="destination-list-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="admin-data-table"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="admin-form"]')).toBeNull();
  });

  test("renders the standalone new destination form route", async () => {
    await renderAt("/admin/destinations/new");
    expect(document.querySelector('[data-testid="destination-form-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="destination-form"]')).not.toBeNull();
  });

  test("renders the standalone partner list and new form routes", async () => {
    await renderAt("/admin/partners?approval=pending");
    expect(document.querySelector('[data-testid="partner-list-page"]')).not.toBeNull();
    await act(async () => root.unmount());
    root = null;
    await renderAt("/admin/partners/new");
    expect(document.querySelector('[data-testid="partner-form-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="partner-form"]')).not.toBeNull();
  });

  test("renders partner details with protected document and history tabs", async () => {
    await renderAt("/admin/partners/507f1f77bcf86cd799439011");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.querySelector('[data-testid="partner-detail-page"]')).not.toBeNull();
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(3);
  });

  test("opens the user access drawer from the users table", async () => {
    await renderAt("/admin/users");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    const edit = document.querySelector('[aria-label="Edit akses: user@example.com"]');
    await act(async () => edit.click());
    expect(document.querySelector('[data-testid="user-edit-drawer"]')).not.toBeNull();
  });

  test("opens the plan form drawer from the plans page", async () => {
    await renderAt("/admin/plans");
    const add = document.querySelector('[data-testid="plan-add-btn"]');
    await act(async () => add.click());
    expect(document.querySelector('[data-testid="plan-form-drawer"]')).not.toBeNull();
  });
});
