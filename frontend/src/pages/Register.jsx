import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await register(form.email, form.password, form.name);
    setLoading(false);
    if (res.ok) {
      toast.success(t.auth.registerTitle);
      navigate("/");
    } else {
      setError(res.error);
    }
  };

  const upd = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="max-w-md mx-auto px-4 mt-16 pb-24">
      <div className="neu-raised rounded-3xl p-8 sm:p-10">
        <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-2">
          {t.nav.register}
        </div>
        <h1 className="font-display text-4xl leading-tight mb-8">
          {t.auth.registerTitle}
        </h1>

        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="text-sm text-muted2 pl-2">{t.auth.name}</span>
            <input
              required
              value={form.name}
              onChange={upd("name")}
              className="mt-2 w-full rounded-2xl px-5 py-4 bg-sand shadow-neu-inset outline-none"
              data-testid="register-name-input"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted2 pl-2">{t.auth.email}</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={upd("email")}
              className="mt-2 w-full rounded-2xl px-5 py-4 bg-sand shadow-neu-inset outline-none"
              data-testid="register-email-input"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted2 pl-2">{t.auth.password}</span>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={upd("password")}
              className="mt-2 w-full rounded-2xl px-5 py-4 bg-sand shadow-neu-inset outline-none"
              data-testid="register-password-input"
            />
          </label>

          {error && (
            <div className="text-sm text-red-600" data-testid="register-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 rounded-full bg-sunset text-sand font-semibold text-sm tracking-wide hover:bg-sunset/90 transition-colors disabled:opacity-50"
            data-testid="register-submit-btn"
          >
            {loading ? t.common.loading : t.auth.submitRegister}
          </button>

          <Link
            to="/login"
            className="block text-center text-sm text-muted2 hover:text-sunset transition-colors"
            data-testid="switch-login-link"
          >
            {t.auth.switchToLogin}
          </Link>
        </form>
      </div>
    </div>
  );
}
