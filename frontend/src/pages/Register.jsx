import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import GoogleButton from "@/components/GoogleButton";

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
    <div className="max-w-md mx-auto px-4 mt-8 pb-16">
      <div className="card-flat p-5 sm:p-8">
        <div className="eyebrow">{t.nav.register}</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-3xl leading-tight mb-6">
          {t.auth.registerTitle}
        </h1>

        <form onSubmit={submit} className="space-y-4">
          <GoogleButton testId="google-register-btn" />

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
          <label className="block">
            <span className="text-[13px] text-inkSoft">{t.auth.password}</span>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={upd("password")}
              className="input-flat mt-2"
              data-testid="register-password-input"
            />
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
            to="/login"
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
