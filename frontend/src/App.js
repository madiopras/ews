import React, { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { LanguageProvider } from "./contexts/LanguageContext.jsx";
import Navbar from "./components/Navbar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Home from "./pages/Home.jsx";
import AuthCallback from "./components/AuthCallback.jsx";
import AnalyticsConsent from "./components/AnalyticsConsent.jsx";
import ExperienceFeatureGate from "./components/ExperienceFeatureGate.jsx";
import { authUrl } from "./lib/authNavigation.js";

const Directory = React.lazy(() => import("./pages/Directory.jsx"));
const DestinationDetail = React.lazy(() => import("./pages/DestinationDetail.jsx"));
const Login = React.lazy(() => import("./pages/Login.jsx"));
const Register = React.lazy(() => import("./pages/Register.jsx"));
const Wishlist = React.lazy(() => import("./pages/Wishlist.jsx"));
const Planner = React.lazy(() => import("./pages/Planner.jsx"));
const Partners = React.lazy(() => import("./pages/Partners.jsx"));
const PartnerDetail = React.lazy(() => import("./pages/PartnerDetail.jsx"));
const Profile = React.lazy(() => import("./pages/Profile.jsx"));
const PublicTrip = React.lazy(() => import("./pages/PublicTrip.jsx"));
const Docs = React.lazy(() => import("./pages/Docs.jsx"));
const NotFound = React.lazy(() => import("./pages/NotFound.jsx"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword.jsx"));
const VerifyEmail = React.lazy(() => import("./pages/VerifyEmail.jsx"));
const AdminLayout = React.lazy(() => import("./layouts/AdminLayout.jsx"));
const MitraLayout = React.lazy(() => import("./layouts/MitraLayout.jsx"));
const MitraDashboard = React.lazy(() => import("./pages/mitra/MitraDashboard.jsx"));
const MitraOnboarding = React.lazy(() => import("./pages/mitra/MitraOnboarding.jsx"));
const MitraBusiness = React.lazy(() => import("./pages/mitra/MitraBusiness.jsx"));
const DestinationListPage = React.lazy(() => import("./features/admin/destinations/DestinationListPage.jsx"));
const DestinationFormPage = React.lazy(() => import("./features/admin/destinations/DestinationFormPage.jsx"));
const PartnerListPage = React.lazy(() => import("./features/admin/partners/PartnerListPage.jsx"));
const PartnerFormPage = React.lazy(() => import("./features/admin/partners/PartnerFormPage.jsx"));
const PartnerDetailPage = React.lazy(() => import("./features/admin/partners/PartnerDetailPage.jsx"));
const UserListPage = React.lazy(() => import("./features/admin/users/UserListPage.jsx"));
const PlanListPage = React.lazy(() => import("./features/admin/plans/PlanListPage.jsx"));
const DashboardPage = React.lazy(() => import("./features/admin/dashboard/DashboardPage.jsx"));
const GovernancePage = React.lazy(() => import("./features/admin/governance/GovernancePage.jsx"));
const GeneralSettingsPage = React.lazy(() => import("./features/admin/settings/GeneralSettingsPage.jsx"));
const IntegrationStatusPage = React.lazy(() => import("./features/admin/settings/IntegrationStatusPage.jsx"));
const LlmProfileListPage = React.lazy(() => import("./features/admin/settings/LlmProfileListPage.jsx"));
const LlmProfileFormPage = React.lazy(() => import("./features/admin/settings/LlmProfileFormPage.jsx"));
const EmailTemplateListPage = React.lazy(() => import("./features/admin/settings/EmailTemplateListPage.jsx"));
const EmailTemplateFormPage = React.lazy(() => import("./features/admin/settings/EmailTemplateFormPage.jsx"));
const BackupListPage = React.lazy(() => import("./features/admin/settings/BackupListPage.jsx"));
const LogListPage = React.lazy(() => import("./features/admin/logs/LogListPage.jsx"));
const TripDetail = React.lazy(() => import("./pages/TripDetail.jsx"));

function PageFallback() {
  return <div className="p-10 text-sm text-inkSoft" role="status" aria-live="polite">Loading…</div>;
}

function RouteAnnouncer() {
  const location = useLocation();
  useEffect(() => {
    const timer = window.setTimeout(() => document.getElementById("main-content")?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);
  return <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{location.pathname}</span>;
}

function Protected({ children, adminOnly = false }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="p-10 text-inkSoft">Loading...</div>;
  if (!user || typeof user !== "object") {
    return <Navigate to={authUrl("/login", `${location.pathname}${location.search}`)} replace />;
  }
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function AppShell() {
  const location = useLocation();
  // Emergent OAuth returns to {origin}/profile#session_id=... — handle it before routing
  const isAuthCallback = location.hash?.includes("session_id=");
  const isAdminRoute = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const isMitraRoute = location.pathname === "/mitra" || location.pathname.startsWith("/mitra/");
  const hasDedicatedShell = isAdminRoute || isMitraRoute;
  const ContentRoot = hasDedicatedShell ? "div" : "main";

  return (
    <div className="App bg-cream min-h-screen">
      <a href="#main-content" className="skip-link">Lewati ke konten utama / Skip to main content</a>
      <RouteAnnouncer />
      {!hasDedicatedShell && <Navbar />}
      <ContentRoot id="main-content" tabIndex="-1" className={hasDedicatedShell ? "outline-none" : "public-main outline-none"}>
        {isAuthCallback ? (
          <AuthCallback />
        ) : (
        <React.Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Directory />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/partners/:id" element={<PartnerDetail />} />
          <Route path="/partners/register" element={<Protected><Navigate to="/mitra/onboarding" replace /></Protected>} />
          <Route path="/destination/:id" element={<DestinationDetail />} />
          <Route path="/trip/:slug" element={<PublicTrip />} />
          <Route path="/saved/trips/:id" element={<Protected><React.Suspense fallback={<div className="p-10 text-inkSoft">Loading...</div>}><TripDetail /></React.Suspense></Protected>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/profile" element={<Profile />} />
          <Route
            path="/wishlist"
            element={
              <Protected>
                <Wishlist />
              </Protected>
            }
          />
          <Route
            path="/mitra"
            element={
              <Protected>
                <MitraLayout />
              </Protected>
            }
          >
            <Route index element={<ExperienceFeatureGate feature="mitra_dashboard"><MitraDashboard /></ExperienceFeatureGate>} />
            <Route path="onboarding" element={<ExperienceFeatureGate feature="mitra_onboarding"><MitraOnboarding /></ExperienceFeatureGate>} />
            <Route path="onboarding/:id" element={<MitraOnboarding />} />
            <Route path="business/:id" element={<MitraBusiness />} />
            <Route path="*" element={<Navigate to="/mitra" replace />} />
          </Route>
          <Route
            path="/admin"
            element={
              <Protected adminOnly>
                <AdminLayout />
              </Protected>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="governance" element={<GovernancePage />} />
            <Route path="destinations" element={<DestinationListPage />} />
            <Route path="destinations/new" element={<DestinationFormPage />} />
            <Route path="destinations/:id/edit" element={<DestinationFormPage />} />
            <Route path="partners" element={<PartnerListPage />} />
            <Route path="partners/new" element={<PartnerFormPage />} />
            <Route path="partners/:id" element={<PartnerDetailPage />} />
            <Route path="partners/:id/edit" element={<PartnerFormPage />} />
            <Route path="plans" element={<PlanListPage />} />
            <Route path="users" element={<UserListPage />} />
            <Route path="membership" element={<Navigate to="/admin/users" replace />} />
            <Route path="settings" element={<Navigate to="/admin/settings/general" replace />} />
            <Route path="settings/general" element={<GeneralSettingsPage />} />
            <Route path="settings/integrations" element={<IntegrationStatusPage />} />
            <Route path="settings/llm" element={<LlmProfileListPage />} />
            <Route path="settings/llm/new" element={<LlmProfileFormPage />} />
            <Route path="settings/llm/:id/edit" element={<LlmProfileFormPage />} />
            <Route path="settings/email-templates" element={<EmailTemplateListPage />} />
            <Route path="settings/email-templates/new" element={<EmailTemplateFormPage />} />
            <Route path="settings/email-templates/:id/edit" element={<EmailTemplateFormPage />} />
            <Route path="settings/backups" element={<BackupListPage />} />
            <Route path="logs" element={<Navigate to="/admin/logs/audit" replace />} />
            <Route path="logs/audit" element={<LogListPage type="audit" />} />
            <Route path="logs/ai-planner" element={<LogListPage type="ai" />} />
            <Route path="logs/system" element={<LogListPage type="system" />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </React.Suspense>
        )}
      </ContentRoot>
      {!hasDedicatedShell && <BottomNav />}
      {!hasDedicatedShell && <AnalyticsConsent />}
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
