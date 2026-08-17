import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
      navigate("/login", { replace: true });
      return;
    }

    api
      .post("/auth/google/session", { session_id: sessionId })
      .then(({ data }) => {
        setUser(data);
        window.history.replaceState(null, "", "/profile");
        navigate("/profile", { replace: true });
      })
      .catch(() => {
        setFailed(true);
        toast.error(t.auth.googleFailed);
        window.history.replaceState(null, "", "/login");
        navigate("/login", { replace: true });
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
