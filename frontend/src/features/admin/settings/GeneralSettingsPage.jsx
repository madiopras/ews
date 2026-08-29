import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormActions } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { formatError } from "../../../lib/api.js";
import { getGeneralSettings, updateGeneralSettings } from "./settingsApi.js";

export default function GeneralSettingsPage() {
  const { t } = useLang();
  const copy = t.admin.settings;
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState("");
  const query = useQuery({ queryKey: ["admin", "settings", "general"], queryFn: ({ signal }) => getGeneralSettings(signal) });
  useEffect(() => { if (query.data) { setForm(query.data); setInitial(JSON.stringify(query.data)); } }, [query.data]);
  const dirty = form && JSON.stringify(form) !== initial;
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const mutation = useMutation({
    mutationFn: updateGeneralSettings,
    onSuccess: (data) => { setForm(data); setInitial(JSON.stringify(data)); toast.success(t.admin.settings.saved); },
    onError: (error) => toast.error(formatError(error.response?.data?.detail || copy.saveError)),
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  if (query.isLoading) return <div className="p-8 text-sm text-inkSoft">Loading...</div>;
  if (query.isError || !form) return <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{copy.loadError}</div>;
  return <div className="app-gutter w-full py-6 pb-16" data-testid="general-settings-page">
    <header className="mb-5"><div className="eyebrow">Admin · Settings</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl">{copy.generalTitle}</h1><p className="text-[13px] text-inkSoft mt-2">{copy.generalSub}</p></header>
    <form className="card-flat p-5 sm:p-6 max-w-4xl space-y-5" onSubmit={(e) => { e.preventDefault(); mutation.mutate({
      ...form,
      partner_review_sla_days: Number(form.partner_review_sla_days),
      backup_retention_days: Number(form.backup_retention_days),
      planner_guest_generation_limit: Number(form.planner_guest_generation_limit),
      planner_guest_identity_ttl_days: Number(form.planner_guest_identity_ttl_days),
      planner_guest_ip_daily_limit: Number(form.planner_guest_ip_daily_limit),
      planner_authenticated_daily_limit: Number(form.planner_authenticated_daily_limit),
      planner_generation_cooldown_seconds: Number(form.planner_generation_cooldown_seconds),
      mitra_onboarding_rollout_percentage: Number(form.mitra_onboarding_rollout_percentage),
      mitra_dashboard_rollout_percentage: Number(form.mitra_dashboard_rollout_percentage),
    }); }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-xs font-semibold text-inkSoft">{t.admin.settings.siteName}<input className="input-flat mt-1.5" required value={form.site_name} onChange={(e) => set("site_name", e.target.value)} /></label>
        <label className="text-xs font-semibold text-inkSoft">{t.admin.settings.supportEmail}<input className="input-flat mt-1.5" required type="email" value={form.support_email} onChange={(e) => set("support_email", e.target.value)} /></label>
        <label className="text-xs font-semibold text-inkSoft">{t.admin.settings.defaultLanguage}<select className="input-flat mt-1.5" value={form.default_language} onChange={(e) => set("default_language", e.target.value)}><option value="id">Indonesia</option><option value="en">English</option></select></label>
        <label className="text-xs font-semibold text-inkSoft">{t.admin.settings.reviewSla}<input className="input-flat mt-1.5" type="number" min="1" max="30" value={form.partner_review_sla_days} onChange={(e) => set("partner_review_sla_days", e.target.value)} /></label>
        <label className="text-xs font-semibold text-inkSoft">{t.admin.settings.retention}<input className="input-flat mt-1.5" type="number" min="1" max="365" value={form.backup_retention_days} onChange={(e) => set("backup_retention_days", e.target.value)} /></label>
      </div>
      <div className="border-t border-line pt-4 grid sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="w-4 h-4 accent-toba" checked={form.planner_enabled} onChange={(e) => set("planner_enabled", e.target.checked)} />{t.admin.settings.plannerEnabled}</label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="w-4 h-4 accent-toba" checked={form.maintenance_mode} onChange={(e) => set("maintenance_mode", e.target.checked)} />{t.admin.settings.maintenanceMode}</label>
      </div>
      <section className="border-t border-line pt-5" aria-labelledby="planner-cost-controls">
        <h2 id="planner-cost-controls" className="font-display text-xl text-ink">{copy.plannerCostControls}</h2>
        <p className="mt-1 text-xs text-inkSoft">{copy.plannerCostControlsSub}</p>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input type="checkbox" className="w-4 h-4 accent-toba" checked={form.planner_guest_trial_enabled} onChange={(e) => set("planner_guest_trial_enabled", e.target.checked)} />
          {copy.guestTrialEnabled}
        </label>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <label className="text-xs font-semibold text-inkSoft">{copy.guestGenerationLimit}<input className="input-flat mt-1.5" type="number" min="1" max="10" value={form.planner_guest_generation_limit} onChange={(e) => set("planner_guest_generation_limit", e.target.value)} /></label>
          <label className="text-xs font-semibold text-inkSoft">{copy.guestIdentityTtl}<input className="input-flat mt-1.5" type="number" min="1" max="365" value={form.planner_guest_identity_ttl_days} onChange={(e) => set("planner_guest_identity_ttl_days", e.target.value)} /></label>
          <label className="text-xs font-semibold text-inkSoft">{copy.guestIpDailyLimit}<input className="input-flat mt-1.5" type="number" min="1" max="1000" value={form.planner_guest_ip_daily_limit} onChange={(e) => set("planner_guest_ip_daily_limit", e.target.value)} /></label>
          <label className="text-xs font-semibold text-inkSoft">{copy.userDailyLimit}<input className="input-flat mt-1.5" type="number" min="0" max="1000" value={form.planner_authenticated_daily_limit} onChange={(e) => set("planner_authenticated_daily_limit", e.target.value)} /></label>
          <label className="text-xs font-semibold text-inkSoft">{copy.generationCooldown}<input className="input-flat mt-1.5" type="number" min="0" max="3600" value={form.planner_generation_cooldown_seconds} onChange={(e) => set("planner_generation_cooldown_seconds", e.target.value)} /></label>
        </div>
      </section>
      <section className="border-t border-line pt-5" aria-labelledby="mitra-rollout-controls">
        <h2 id="mitra-rollout-controls" className="font-display text-xl text-ink">{copy.mitraRollout}</h2>
        <p className="mt-1 text-xs text-inkSoft">{copy.mitraRolloutSub}</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {[
            ["mitra_onboarding", copy.mitraOnboarding],
            ["mitra_dashboard", copy.mitraDashboard],
          ].map(([key, label]) => <fieldset key={key} className="rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-semibold">{label}</legend>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-toba" checked={form[`${key}_enabled`]} onChange={(event) => set(`${key}_enabled`, event.target.checked)} />
              {copy.rolloutEnabled}
            </label>
            <label className="mt-4 block text-xs font-semibold text-inkSoft">
              {copy.rolloutPercentage}: {form[`${key}_rollout_percentage`]}%
              <input className="mt-2 w-full accent-toba" type="range" min="0" max="100" step="5" value={form[`${key}_rollout_percentage`]} onChange={(event) => set(`${key}_rollout_percentage`, event.target.value)} />
            </label>
          </fieldset>)}
        </div>
      </section>
      <FormActions onCancel={() => { setForm(query.data); setInitial(JSON.stringify(query.data)); }} saving={mutation.isPending} disabled={!dirty} saveLabel={t.admin.settings.saveGeneral} />
    </form>
  </div>;
}
