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
    <div className="max-w-md mx-auto px-4 mt-8 pb-16">
      <div className="card-flat p-5 sm:p-8">
        <div className="eyebrow">{t.nav.login}</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-3xl leading-tight mb-6">
          {t.auth.loginTitle}
        </h1>

        <form onSubmit={submit} className="space-y-4">
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
          <label className="block">
            <span className="text-[13px] text-inkSoft">{t.auth.password}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-flat mt-2"
              data-testid="login-password-input"
            />
          </label>

          {error && (
            <div className="text-[13px] text-red-600" data-testid="login-error">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="login-submit-btn">
            {loading ? t.common.loading : t.auth.submitLogin}
          </button>

          <Link
            to="/register"
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
