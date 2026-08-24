import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useLang } from "../contexts/LanguageContext.jsx";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authUrl, resumeAuthIntent, safeNextPath } from "../lib/authNavigation.js";

// Handles the Emergent OAuth return: #session_id=... → app session cookie.
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { t } = useLang();
  const processed = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const sessionId = new URLSearchParams(location.hash.replace(/^#/, "")).get("session_id");
    if (!sessionId) {
      const next = safeNextPath(sessionStorage.getItem("auth_next"), "/profile");
      navigate(authUrl("/login", next), { replace: true });
      return;
    }

    api
      .post("/auth/google/session", { session_id: sessionId })
      .then(async ({ data }) => {
        setUser(data);
        const next = safeNextPath(sessionStorage.getItem("auth_next"), "/profile");
        const intent = sessionStorage.getItem("auth_intent") || "";
        try {
          await resumeAuthIntent(intent, api);
        } catch {
          toast.error(t.auth.intentFailed);
        }
        sessionStorage.removeItem("auth_next");
        sessionStorage.removeItem("auth_intent");
        window.history.replaceState(null, "", next);
        navigate(next, { replace: true });
      })
      .catch(() => {
        setFailed(true);
        toast.error(t.auth.googleFailed);
        const next = safeNextPath(sessionStorage.getItem("auth_next"), "/profile");
        const loginUrl = authUrl("/login", next);
        window.history.replaceState(null, "", loginUrl);
        navigate(loginUrl, { replace: true });
      });
  }, [location.hash, navigate, setUser, t]);

  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-inkSoft"
      data-testid="auth-callback"
    >
      {!failed && <Loader2 className="w-6 h-6 animate-spin text-toba" />}
      <p className="text-[13px]">{failed ? t.auth.googleFailed : t.auth.signingIn}</p>
    </div>
  );
}
