import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
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
      toast.success(t.auth.loginTitle);
      navigate("/");
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 mt-16 pb-24">
      <div className="neu-raised rounded-3xl p-8 sm:p-10">
        <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-2">
          {t.nav.login}
        </div>
        <h1 className="font-display text-4xl leading-tight mb-8">
          {t.auth.loginTitle}
        </h1>

        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="text-sm text-muted2 pl-2">{t.auth.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-2xl px-5 py-4 bg-sand shadow-neu-inset outline-none text-ink"
              data-testid="login-email-input"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted2 pl-2">{t.auth.password}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-2xl px-5 py-4 bg-sand shadow-neu-inset outline-none text-ink"
              data-testid="login-password-input"
            />
          </label>

          {error && (
            <div className="text-sm text-red-600" data-testid="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 rounded-full bg-sunset text-sand font-semibold text-sm tracking-wide hover:bg-sunset/90 transition-colors disabled:opacity-50"
            data-testid="login-submit-btn"
          >
            {loading ? t.common.loading : t.auth.submitLogin}
          </button>

          <Link
            to="/register"
            className="block text-center text-sm text-muted2 hover:text-sunset transition-colors"
            data-testid="switch-register-link"
          >
            {t.auth.switchToRegister}
          </Link>
        </form>
      </div>
    </div>
  );
}
