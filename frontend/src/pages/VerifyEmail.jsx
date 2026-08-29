import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, MailWarning } from "lucide-react";
import { api, formatError } from "../lib/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useLang } from "../contexts/LanguageContext.jsx";
import Seo from "../components/Seo.jsx";
import { localizedAuthError } from "../lib/authNavigation.js";

export default function VerifyEmail() {
  const { t } = useLang();
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const isAuthenticated = Boolean(user && typeof user === "object");
  const [status, setStatus] = useState(token ? "loading" : "idle");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    api.post("/auth/verify-email", { token }).then(async () => {
      if (isAuthenticated) {
        try {
          const { data } = await api.get("/auth/me");
          setUser(data);
        } catch {
          // Verification is still complete when the link is opened in another browser.
        }
      }
      setStatus("verified");
    }).catch((requestError) => {
      setError(localizedAuthError(formatError(requestError.response?.data?.detail), t.auth.errors));
      setStatus("error");
    });
  }, [isAuthenticated, setUser, t.auth.errors, token]);
  const resend = async () => {
    setStatus("loading");
    setError("");
    try {
      await api.post("/auth/verify-email/resend");
      setStatus("sent");
    } catch (requestError) {
      setError(localizedAuthError(formatError(requestError.response?.data?.detail), t.auth.errors));
      setStatus("error");
    }
  };
  const verified = status === "verified" || user?.email_verified;
  return (
    <main className="app-gutter mx-auto mt-6 max-w-md sm:mt-8 md:pb-16"><Seo title={t.auth.verifyEmail} description={t.auth.verifyDescription} noIndex /><div className="card-flat p-5 text-center sm:p-8">{verified ? <CheckCircle2 className="mx-auto h-10 w-10 text-toba" /> : <MailWarning className="mx-auto h-10 w-10 text-brick" />}<h1 className="mt-4 font-display text-3xl">{verified ? t.auth.emailVerified : t.auth.verifyEmail}</h1><p className="mt-2 text-sm text-inkSoft" role="status">{status === "sent" ? t.auth.verificationSent : verified ? t.auth.emailVerifiedDescription : t.auth.verifyDescription}</p>{error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}{!verified && user && <button onClick={resend} disabled={status === "loading"} className="btn-primary mt-6 w-full">{status === "loading" ? t.common.loading : t.auth.resendVerification}</button>}<Link to={user ? "/profile" : "/login"} className="btn-outline mt-3 w-full">{user ? t.nav.profile : t.auth.backToLogin}</Link></div></main>
  );
}
