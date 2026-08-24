import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatError } from "../lib/api.js";
import { clearAccountSession } from "../lib/offline.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = not auth, object = auth
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setReady(true);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (mounted) setUser(data);
      })
      .catch(() => {
        if (!mounted) return;
        // Never infer an authenticated identity from shared browser storage.
        setUser(false);
      })
      .finally(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser((current) => {
        if (current && typeof current === "object" && current.id !== data.id) clearAccountSession(current.id);
        return data;
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: formatError(error.response?.data?.detail) || error.message };
    }
  }, []);

  const register = useCallback(async (email, password, name, acceptedTerms = false) => {
    try {
      const { data } = await api.post("/auth/register", { email, password, name, accepted_terms: acceptedTerms });
      setUser((current) => {
        if (current && typeof current === "object" && current.id !== data.id) clearAccountSession(current.id);
        return data;
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatError(e.response?.data?.detail) || e.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    clearAccountSession(user && typeof user === "object" ? user.id : null);
    setUser(false);
  }, [user]);

  const setGoogleUser = useCallback((data) => {
    setUser((current) => {
      if (current && typeof current === "object" && current.id !== data.id) clearAccountSession(current.id);
      return data;
    });
    setReady(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, ready, login, register, logout, setUser: setGoogleUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
