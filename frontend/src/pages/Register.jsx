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

export default function Register() {
  const { register, user, ready } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const intent = params.get("intent") || "";
  const [form, setForm] = useState({ name: "", email: "", password: "", accepted_terms: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await register(form.email, form.password, form.name, form.accepted_terms);
    setLoading(false);
    if (res.ok) {
      try {
        await resumeAuthIntent(intent, api);
      } catch {
        toast.error(t.auth.intentFailed);
      }
      toast.success(t.auth.registerTitle);
      navigate(next);
    } else {
      setError(localizedAuthError(res.error, t.auth.errors));
    }
  };

  const upd = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (ready && user && typeof user === "object") return <Navigate to={next} replace />;

  return (
    <div className="max-w-md mx-auto px-4 mt-8 pb-16">
      <Seo title={t.auth.registerTitle} description={t.profile.guestSubtitle} noIndex />
      <div className="card-flat p-5 sm:p-8">
        <div className="eyebrow">{t.nav.register}</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-3xl leading-tight mb-6">
          {t.auth.registerTitle}
        </h1>

        <form onSubmit={submit} className="space-y-4">
          <GoogleButton testId="google-register-btn" next={next} intent={intent} />

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-inkSoft">{t.auth.or}</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <label className="block">
            <span className="text-[13px] text-inkSoft">{t.auth.name}</span>
            <input required value={form.name} onChange={upd("name")} className="input-flat mt-2" data-testid="register-name-input" />
          </label>
          <label className="block">
            <span className="text-[13px] text-inkSoft">{t.auth.email}</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={upd("email")}
              className="input-flat mt-2"
              data-testid="register-email-input"
            />
          </label>
          <PasswordField label={t.auth.password} value={form.password} onChange={upd("password")} hint={t.auth.passwordHint} showStrength testId="register-password-input" autoComplete="new-password" showPasswordLabel={t.auth.showPassword} hidePasswordLabel={t.auth.hidePassword} />

          <label className="flex items-start gap-3 text-[13px] text-inkSoft">
            <input type="checkbox" required checked={form.accepted_terms} onChange={upd("accepted_terms")} className="mt-1 h-4 w-4 accent-toba" data-testid="register-consent" />
            <span>{t.auth.consentPrefix} <Link to="/docs?section=syarat-ketentuan" className="font-semibold text-toba hover:underline">{t.auth.terms}</Link> {t.auth.and} <Link to="/docs?section=kebijakan" className="font-semibold text-toba hover:underline">{t.auth.privacy}</Link>.</span>
          </label>

          {error && (
            <div className="text-[13px] text-red-600" data-testid="register-error">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="register-submit-btn">
            {loading ? t.common.loading : t.auth.submitRegister}
          </button>

          <Link
            to={authUrl("/login", next, intent)}
            className="block text-center text-[13px] text-inkSoft hover:text-toba transition-colors py-3"
            data-testid="switch-login-link"
          >
            {t.auth.switchToLogin}
          </Link>
        </form>
      </div>
    </div>
  );
}
