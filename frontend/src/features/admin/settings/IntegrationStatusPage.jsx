import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Database, PlugZap, ShieldCheck, XCircle } from "lucide-react";
import { StatusBadge } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { getIntegrationStatus } from "./settingsApi.js";

export default function IntegrationStatusPage() {
  const { t } = useLang(); const copy = t.admin.settings;
  const query = useQuery({ queryKey: ["admin", "settings", "integrations"], queryFn: ({ signal }) => getIntegrationStatus(signal) });
  const entries = Object.entries(query.data || {});
  return <div className="w-full px-4 sm:px-6 xl:px-8 py-6 pb-16" data-testid="integration-settings-page">
    <header className="mb-5"><div className="eyebrow">Admin · Settings</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl">{copy.integrationsTitle}</h1><p className="text-[13px] text-inkSoft mt-2">{copy.integrationsSub}</p></header>
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[12px] text-amber-900 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0" />{t.admin.settings.secretNote}</div>
    {query.isLoading ? <div className="p-8 text-inkSoft">Loading...</div> : query.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{copy.loadError}</div> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{entries.map(([key, item]) => {
      const configured = item.configured !== false; const healthy = item.healthy !== false;
      return <article key={key} className="card-flat p-5"><div className="flex items-start justify-between gap-3"><span className="w-10 h-10 rounded-xl bg-line/30 text-toba flex items-center justify-center">{key === "database" ? <Database className="w-5 h-5" /> : <PlugZap className="w-5 h-5" />}</span>{configured && healthy ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-600" />}</div><h2 className="font-semibold mt-4 capitalize">{key.replaceAll("_", " ")}</h2><div className="mt-3"><StatusBadge variant={configured ? (healthy ? "success" : "danger") : "neutral"}>{configured ? (healthy ? t.admin.settings.configured : copy.error) : t.admin.settings.notConfigured}</StatusBadge></div>{item.environment && <p className="text-xs text-inkSoft mt-3">Environment: {item.environment}</p>}{item.mode && <p className="text-xs text-inkSoft mt-1">Mode: {item.mode}</p>}</article>;
    })}</div>}
  </div>;
}
