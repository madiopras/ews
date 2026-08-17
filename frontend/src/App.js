import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Home from "@/pages/Home";
import Directory from "@/pages/Directory";
import DestinationDetail from "@/pages/DestinationDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Wishlist from "@/pages/Wishlist";
import Admin from "@/pages/Admin";
import Planner from "@/pages/Planner";
import Partners from "@/pages/Partners";
import PartnerRegister from "@/pages/PartnerRegister";
import Profile from "@/pages/Profile";

function Protected({ children, adminOnly = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-10 text-inkSoft">Loading...</div>;
  if (!user || typeof user !== "object") return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function AppShell() {
  return (
    <div className="App bg-cream min-h-screen">
      <Navbar />
      <main className="pb-20 md:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Directory />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/partners/register" element={<PartnerRegister />} />
          <Route path="/destination/:id" element={<DestinationDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
            path="/admin"
            element={
              <Protected adminOnly>
                <Admin />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
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
