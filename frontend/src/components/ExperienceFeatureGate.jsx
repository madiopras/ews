import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";

export default function ExperienceFeatureGate({ feature, children }) {
  const { lang, t } = useLang();
  const [state, setState] = useState({ status: "loading", decision: null });
  const load = () => {
    setState({ status: "loading", decision: null });
    api.get("/experience/features")
      .then(({ data }) => setState({ status: "ready", decision: data[feature] }))
      .catch(() => setState({ status: "error", decision: null }));
  };
  useEffect(load, [feature]);

  if (state.status === "loading") {
    return <div className="p-8 text-sm text-inkSoft" role="status" aria-live="polite">{t.common.loading}</div>;
  }
  if (state.status === "error") {
    return <div className="p-8 text-center" role="alert"><p className="text-red-700">{t.common.error}</p><button type="button" onClick={load} className="btn-outline mt-4"><RefreshCw className="h-4 w-4" />{t.common.retry}</button></div>;
  }
  if (!state.decision?.enabled) {
    const copy = lang === "en" ? {
      title: "This feature is being released gradually",
      body: "Your account is not included in this rollout yet. Your existing public account and trip data are unaffected.",
      back: "Back to website",
    } : {
      title: "Fitur ini sedang dirilis bertahap",
      body: "Akun Anda belum termasuk dalam rollout ini. Akun publik dan data perjalanan yang sudah ada tidak terpengaruh.",
      back: "Kembali ke website",
    };
    return <div className="app-gutter mx-auto max-w-xl py-16 text-center" data-testid={`feature-gate-${feature}`}>
      <LockKeyhole className="mx-auto h-10 w-10 text-toba" aria-hidden="true" />
      <h1 className="mt-4 font-display text-3xl">{copy.title}</h1>
      <p className="mt-3 text-sm leading-6 text-inkSoft">{copy.body}</p>
      <Link to="/" className="btn-primary mt-6">{copy.back}</Link>
    </div>;
  }
  return children;
}
