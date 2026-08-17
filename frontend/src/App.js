import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Directory from "@/pages/Directory";
import DestinationDetail from "@/pages/DestinationDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Wishlist from "@/pages/Wishlist";
import Admin from "@/pages/Admin";
import Planner from "@/pages/Planner";

function Protected({ children, adminOnly = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-10 text-muted2">Loading...</div>;
  if (!user || typeof user !== "object") return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function AppShell() {
  return (
    <div className="App bg-sand min-h-screen pt-4">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Directory />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/destination/:id" element={<DestinationDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
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
      <Toaster position="top-right" richColors />
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
