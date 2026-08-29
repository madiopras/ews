import React, { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useLang } from "../contexts/LanguageContext.jsx";
import { toast } from "sonner";
import GoogleButton from "../components/GoogleButton.jsx";
import { authUrl, localizedAuthError, resumeAuthIntent, safeNextPath } from "../lib/authNavigation.js";
import PasswordField from "../components/PasswordField.jsx";
import { api } from "../lib/api.js";
import Seo from "../components/Seo.jsx";

export default function Login() {
  const { login, user, ready } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const intent = params.get("intent") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      try {
        await resumeAuthIntent(intent, api);
      } catch {
        toast.error(t.auth.intentFailed);
      }
      toast.success(t.auth.loginTitle);
      navigate(next);
    } else {
      setError(localizedAuthError(res.error, t.auth.errors));
    }
  };

  if (ready && user && typeof user === "object") return <Navigate to={next} replace />;

  return (
    <div className="app-gutter mx-auto mt-6 max-w-md sm:mt-8 md:pb-16">
      <Seo title={t.auth.loginTitle} description={t.profile.guestSubtitle} noIndex />
      <div className="card-flat p-5 sm:p-8">
        <div className="eyebrow">{t.nav.login}</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-3xl leading-tight mb-6">
          {t.auth.loginTitle}
        </h1>

        <form onSubmit={submit} className="space-y-4">
          <GoogleButton testId="google-login-btn" next={next} intent={intent} />

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-inkSoft">{t.auth.or}</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <label className="block">
            <span className="text-[13px] text-inkSoft">{t.auth.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-flat mt-2"
              data-testid="login-email-input"
            />
          </label>
          <PasswordField label={t.auth.password} value={password} onChange={(e) => setPassword(e.target.value)} testId="login-password-input" showPasswordLabel={t.auth.showPassword} hidePasswordLabel={t.auth.hidePassword} />
          <div className="text-right"><Link to="/forgot-password" className="text-[13px] font-semibold text-toba hover:underline">{t.auth.forgotPassword}</Link></div>

          {error && (
            <div className="text-[13px] text-red-600" data-testid="login-error">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="login-submit-btn">
            {loading ? t.common.loading : t.auth.submitLogin}
          </button>

          <Link
            to={authUrl("/register", next, intent)}
            className="block text-center text-[13px] text-inkSoft hover:text-toba transition-colors py-3"
            data-testid="switch-register-link"
          >
            {t.auth.switchToRegister}
          </Link>
        </form>
      </div>
    </div>
  );
}
