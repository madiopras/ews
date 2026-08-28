import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLang } from "../contexts/LanguageContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { api } from "../lib/api.js";
import { resumeAuthIntent, safeNextPath } from "../lib/authNavigation.js";
import { renderGoogleIdentityButton } from "../lib/googleIdentity.js";

export default function GoogleButton({ testId = "google-login-btn", next = "/profile", intent = "" }) {
  const { t } = useLang();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const buttonHost = useRef(null);
  const [state, setState] = useState("loading");

  const handleCredential = useCallback(async (response) => {
    if (!response?.credential) {
      setState("error");
      return;
    }
    setState("signing-in");
    try {
      const { data } = await api.post("/auth/google", { credential: response.credential });
      setUser(data);
      try {
        await resumeAuthIntent(intent, api);
      } catch {
        toast.error(t.auth.intentFailed);
      }
      window.dispatchEvent(new CustomEvent("app-auth-success", { detail: { provider: "google" } }));
      navigate(safeNextPath(next, "/profile"), { replace: true });
    } catch {
      setState("error");
      toast.error(t.auth.googleFailed);
    }
  }, [intent, navigate, next, setUser, t.auth.googleFailed, t.auth.intentFailed]);

  useEffect(() => {
    let disposed = false;
    let cleanup;
    setState("loading");
    api.get("/auth/google/config")
      .then(({ data }) => {
        if (!data?.enabled || !data.client_id) throw new Error("Google sign-in is not configured");
        return renderGoogleIdentityButton(buttonHost.current, data.client_id, handleCredential);
      })
      .then((disposeButton) => {
        if (disposed) disposeButton();
        else {
          cleanup = disposeButton;
          setState("ready");
        }
      })
      .catch(() => {
        if (!disposed) setState("unavailable");
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [handleCredential]);

  return (
    <div className="w-full" data-testid={testId}>
      <div ref={buttonHost} className={`flex min-h-11 w-full items-center justify-center overflow-hidden ${state !== "ready" ? "rounded border border-line bg-white" : ""}`} aria-busy={["loading", "signing-in"].includes(state)} />
      {state === "loading" && <p className="mt-1 text-center text-[11px] text-inkSoft" role="status">{t.common.loading}</p>}
      {state === "signing-in" && <p className="mt-1 text-center text-[11px] text-inkSoft" role="status">{t.auth.signingIn}</p>}
      {state === "unavailable" && <p className="mt-1 text-center text-[11px] text-red-600" role="alert">{t.auth.googleUnavailable}</p>}
      {state === "error" && <p className="mt-1 text-center text-[11px] text-red-600" role="alert">{t.auth.googleFailed}</p>}
    </div>
  );
}
