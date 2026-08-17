import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = not auth, object = auth
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (mounted) setUser(data);
      })
      .catch(() => {
        if (mounted) setUser(false);
      })
      .finally(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatError(e.response?.data?.detail) || e.message };
    }
  }, []);

  const register = useCallback(async (email, password, name) => {
    try {
      const { data } = await api.post("/auth/register", { email, password, name });
      setUser(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatError(e.response?.data?.detail) || e.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      // ignore
    }
    setUser(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
