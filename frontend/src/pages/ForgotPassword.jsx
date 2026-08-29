import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { api, formatError } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import Seo from "../components/Seo.jsx";
import { localizedAuthError } from "../lib/authNavigation.js";

export default function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setStatus("sent");
    } catch (requestError) {
      setError(localizedAuthError(formatError(requestError.response?.data?.detail), t.auth.errors));
      setStatus("idle");
    }
  };
  return (
    <main className="app-gutter mx-auto mt-6 max-w-md sm:mt-8 md:pb-16">
      <Seo title={t.auth.forgotPassword} description={t.auth.forgotDescription} noIndex />
      <div className="card-flat p-6 sm:p-8">
        <h1 className="font-display text-3xl">{t.auth.forgotPassword}</h1>
        <p className="mt-2 text-sm text-inkSoft">{t.auth.forgotDescription}</p>
        {status === "sent" ? <div className="mt-6 rounded-xl border border-toba/20 bg-toba/5 p-5 text-center" role="status"><MailCheck className="mx-auto h-8 w-8 text-toba" /><p className="mt-3 text-sm">{t.auth.forgotSent}</p></div> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="block"><span className="text-[13px] text-inkSoft">{t.auth.email}</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-flat mt-2" /></label>{error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}<button disabled={status === "loading"} className="btn-primary w-full">{status === "loading" ? t.common.loading : t.auth.sendReset}</button></form>}
        <Link to="/login" className="mt-5 block text-center text-sm text-toba hover:underline">{t.auth.backToLogin}</Link>
      </div>
    </main>
  );
}
