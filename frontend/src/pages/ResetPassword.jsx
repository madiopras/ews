import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatError } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import PasswordField from "../components/PasswordField.jsx";
import Seo from "../components/Seo.jsx";
import { localizedAuthError } from "../lib/authNavigation.js";

export default function ResetPassword() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (password !== confirmation) return setError(t.auth.passwordMismatch);
    setStatus("loading");
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setStatus("done");
    } catch (requestError) {
      setError(localizedAuthError(formatError(requestError.response?.data?.detail), t.auth.errors));
      setStatus("idle");
    }
  };
  return (
    <main className="mx-auto mt-8 max-w-md px-4 pb-16">
      <Seo title={t.auth.resetPassword} description={t.auth.resetDescription} noIndex />
      <div className="card-flat p-6 sm:p-8"><h1 className="font-display text-3xl">{t.auth.resetPassword}</h1><p className="mt-2 text-sm text-inkSoft">{t.auth.resetDescription}</p>{!token ? <div className="mt-6"><p className="text-sm text-red-600" role="alert">{t.auth.invalidResetLink}</p><Link to="/forgot-password" className="btn-outline mt-4 w-full">{t.auth.requestNewLink}</Link></div> : status === "done" ? <div className="mt-6 text-center"><p className="text-sm text-inkSoft" role="status">{t.auth.resetSuccess}</p><Link to="/login" className="btn-primary mt-5 w-full">{t.auth.backToLogin}</Link></div> : <form onSubmit={submit} className="mt-6 space-y-4"><PasswordField label={t.auth.newPassword} value={password} onChange={(event) => setPassword(event.target.value)} hint={t.auth.passwordHint} showStrength autoComplete="new-password" showPasswordLabel={t.auth.showPassword} hidePasswordLabel={t.auth.hidePassword} /><PasswordField label={t.auth.confirmPassword} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" showPasswordLabel={t.auth.showPassword} hidePasswordLabel={t.auth.hidePassword} />{error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}<button disabled={status === "loading"} className="btn-primary w-full">{status === "loading" ? t.common.loading : t.auth.savePassword}</button></form>}</div>
    </main>
  );
}
