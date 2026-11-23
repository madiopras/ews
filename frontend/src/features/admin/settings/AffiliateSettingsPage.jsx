import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { FormActions } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { formatError } from "../../../lib/api.js";
import {
  getAffiliateAnalytics,
  getTiketAffiliateConfig,
  previewTiketAffiliateConfig,
  updateTiketAffiliateConfig,
} from "./settingsApi.js";

const SECRET_FIELDS = [
  {
    key: "miniapp_api_key",
    hasKey: "has_miniapp_api_key",
    labelId: "MiniApp API Key (header aff-b2b2c-key)",
    labelEn: "MiniApp API Key (aff-b2b2c-key header)",
    multiline: false,
  },
  {
    key: "miniapp_rsa_public_key",
    hasKey: "has_miniapp_rsa_public_key",
    labelId: "MiniApp RSA Public Key (PEM, opsional untuk autologin)",
    labelEn: "MiniApp RSA Public Key (PEM, optional for autologin)",
    multiline: true,
  },
  {
    key: "hotel_v2_auth",
    hasKey: "has_hotel_v2_auth",
    labelId: "Hotel API V2 Credential (header Authorization / Auth)",
    labelEn: "Hotel API V2 Credential (Authorization / Auth header)",
    multiline: false,
  },
  {
    key: "flight_v2_api_key",
    hasKey: "has_flight_v2_api_key",
    labelId: "Flight API v2.0 Key (header Aff-Api-Key)",
    labelEn: "Flight API v2.0 Key (Aff-Api-Key header)",
    multiline: false,
  },
];

const SUMUT_ZONES = [
  { value: "toba_samosir", label: "Danau Toba / Samosir (DTB)" },
  { value: "medan_deli", label: "Medan & Deli Serdang (KNO)" },
  { value: "karo_berastagi", label: "Berastagi & Karo (KNO)" },
  { value: "langkat_bukit_lawang", label: "Bukit Lawang & Langkat (KNO)" },
  { value: "tapanuli_sibolga", label: "Sibolga & Tapanuli (FLZ/DTB)" },
  { value: "asahan_pantai_timur", label: "Pematangsiantar & Kisaran (KNO)" },
  { value: "nias", label: "Pulau Nias (GNS)" },
];

function createFormState(data) {
  return {
    enabled: Boolean(data.enabled),
    environment: data.environment || "sandbox",
    mode: data.mode || "miniapp",
    partner_identifier: data.partner_identifier || "",
    partner_slug: data.partner_slug || "",
    affiliate_id: data.affiliate_id || "",
    campaign_url_template: data.campaign_url_template || "",
    miniapp_production_base_url: data.miniapp_production_base_url || "",
    products_enabled: {
      hotel: data.products_enabled?.hotel !== false,
      flight: data.products_enabled?.flight !== false,
    },
    allowed_redirect_hosts_text: (data.allowed_redirect_hosts || []).join("\n"),
    miniapp_api_key_action: "preserve",
    miniapp_api_key: "",
    miniapp_rsa_public_key_action: "preserve",
    miniapp_rsa_public_key: "",
    hotel_v2_auth_action: "preserve",
    hotel_v2_auth: "",
    flight_v2_api_key_action: "preserve",
    flight_v2_api_key: "",
  };
}

export default function AffiliateSettingsPage() {
  const { t, lang } = useLang();
  const copy = t.admin.settings;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState("");
  const [previewZone, setPreviewZone] = useState("toba_samosir");
  const [previewProduct, setPreviewProduct] = useState("hotel");
  const [previewResult, setPreviewResult] = useState(null);

  const configQuery = useQuery({
    queryKey: ["admin", "affiliates", "tiket"],
    queryFn: ({ signal }) => getTiketAffiliateConfig(signal),
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin", "affiliates", "analytics", 30],
    queryFn: ({ signal }) => getAffiliateAnalytics(30, signal),
  });

  useEffect(() => {
    if (configQuery.data) {
      const next = createFormState(configQuery.data);
      setForm(next);
      setInitial(JSON.stringify(next));
    }
  }, [configQuery.data]);

  const dirty = Boolean(form && JSON.stringify(form) !== initial);

  const saveMutation = useMutation({
    mutationFn: updateTiketAffiliateConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "affiliates", "tiket"], data);
      const next = createFormState(data);
      setForm(next);
      setInitial(JSON.stringify(next));
      toast.success(copy.affiliateSaved);
    },
    onError: (error) => toast.error(formatError(error.response?.data?.detail || copy.saveError)),
  });

  const previewMutation = useMutation({
    mutationFn: previewTiketAffiliateConfig,
    onSuccess: (data) => {
      setPreviewResult(data);
    },
    onError: (error) => toast.error(formatError(error.response?.data?.detail || copy.actionError)),
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (configQuery.isLoading) return <div className="p-8 text-sm text-inkSoft">Loading...</div>;
  if (configQuery.isError || !form) {
    return <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{copy.loadError}</div>;
  }

  const serverConfig = configQuery.data;
  const analytics = analyticsQuery.data;

  const submitForm = (event) => {
    event.preventDefault();
    const hosts = form.allowed_redirect_hosts_text
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    saveMutation.mutate({
      enabled: form.enabled,
      environment: form.environment,
      mode: form.mode,
      partner_identifier: form.partner_identifier,
      partner_slug: form.partner_slug,
      affiliate_id: form.affiliate_id,
      campaign_url_template: form.campaign_url_template,
      miniapp_production_base_url: form.miniapp_production_base_url,
      products_enabled: form.products_enabled,
      allowed_redirect_hosts: hosts,
      miniapp_api_key_action: form.miniapp_api_key_action,
      miniapp_api_key: form.miniapp_api_key || null,
      miniapp_rsa_public_key_action: form.miniapp_rsa_public_key_action,
      miniapp_rsa_public_key: form.miniapp_rsa_public_key || null,
      hotel_v2_auth_action: form.hotel_v2_auth_action,
      hotel_v2_auth: form.hotel_v2_auth || null,
      flight_v2_api_key_action: form.flight_v2_api_key_action,
      flight_v2_api_key: form.flight_v2_api_key || null,
    });
  };

  return (
    <div className="app-gutter w-full py-6 pb-16" data-testid="affiliate-settings-page">
      <header className="mb-5">
        <div className="eyebrow">Admin · Settings · Tiket.com Partner API V2</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-4xl">{copy.affiliateTitle}</h1>
        <p className="text-[13px] text-inkSoft mt-2 max-w-3xl">{copy.affiliateSub}</p>
      </header>

      <div className="mb-5 grid gap-4 lg:grid-cols-3 max-w-6xl">
        <div className="card-flat p-4">
          <div className="text-[11px] uppercase tracking-wider text-inkSoft">{copy.affiliateReadiness}</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
            {serverConfig.ready_for_launch ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span className="text-emerald-800">{copy.affiliateReady}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span className="text-amber-900">{copy.affiliateWaitingCreds}</span>
              </>
            )}
          </div>
          {serverConfig.readiness_notes?.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-inkSoft">
              {serverConfig.readiness_notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-flat p-4">
          <div className="text-[11px] uppercase tracking-wider text-inkSoft">Tiket.com Endpoints</div>
          <div className="mt-2 space-y-1 text-xs font-mono text-ink break-all">
            <div>API: {serverConfig.api_base_url}</div>
            <div>MiniApp: {serverConfig.miniapp_base_url}</div>
          </div>
          <p className="mt-2 text-[11px] text-inkSoft">{copy.affiliateScopeNote}</p>
        </div>

        <div className="card-flat p-4">
          <div className="text-[11px] uppercase tracking-wider text-inkSoft">{copy.affiliateAnalytics30d}</div>
          <div className="mt-2 font-display text-3xl text-toba" data-testid="affiliate-total-clicks">
            {analytics ? analytics.total_clicks : "—"}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-inkSoft">
            {(analytics?.by_product || []).map((item) => (
              <span key={item.key} className="rounded-full border border-line bg-cream/70 px-2 py-0.5">
                {item.key}: {item.count}
              </span>
            ))}
            {(!analytics || analytics.by_product?.length === 0) && <span>{copy.affiliateNoClicks}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] items-start max-w-6xl">
        <form className="card-flat p-5 sm:p-6 space-y-5" onSubmit={submitForm}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-toba"
                checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
                data-testid="affiliate-config-enabled"
              />
              {copy.affiliateProviderEnabled}
            </label>
            <span className="inline-flex items-center gap-1.5 text-xs text-inkSoft">
              <ShieldCheck className="h-4 w-4 text-toba" />
              {copy.affiliateRolloutHint}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-inkSoft">
              {copy.affiliateEnvironment}
              <select
                className="input-flat mt-1.5"
                value={form.environment}
                onChange={(e) => set("environment", e.target.value)}
              >
                <option value="sandbox">Sandbox (api.tiketsandbox.net)</option>
                <option value="production">Production (api.tiket.com)</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-inkSoft">
              {copy.affiliateMode}
              <select
                className="input-flat mt-1.5"
                value={form.mode}
                onChange={(e) => set("mode", e.target.value)}
                data-testid="affiliate-mode-select"
              >
                <option value="miniapp">MiniApp B2B2C (Hotel & Flight · No Deposit)</option>
                <option value="direct_api_v2">Direct B2B API V2 (Hotel V2 & Flight v2.0)</option>
                <option value="campaign_link">Campaign / Tracking Link</option>
              </select>
            </label>
          </div>

          <fieldset className="rounded-xl border border-line p-4">
            <legend className="px-1 text-xs font-semibold text-inkSoft">{copy.affiliateVerticals}</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-toba"
                  checked={form.products_enabled.hotel}
                  onChange={(e) =>
                    set("products_enabled", { ...form.products_enabled, hotel: e.target.checked })
                  }
                />
                {lang === "en" ? "Hotel & Homestay (API V2 / MiniApp)" : "Hotel & Homestay (API V2 / MiniApp)"}
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-toba"
                  checked={form.products_enabled.flight}
                  onChange={(e) =>
                    set("products_enabled", { ...form.products_enabled, flight: e.target.checked })
                  }
                />
                {lang === "en" ? "Flight (API v2.0 / MiniApp)" : "Tiket Pesawat (API v2.0 / MiniApp)"}
              </label>
            </div>
          </fieldset>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-inkSoft">
              Partner Identifier (MiniApp Token Path)
              <input
                className="input-flat mt-1.5"
                placeholder="explore-wisata-sumut"
                value={form.partner_identifier}
                onChange={(e) => set("partner_identifier", e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-inkSoft">
              Partner Slug (MiniApp Launch URL)
              <input
                className="input-flat mt-1.5"
                placeholder="explore-sumut"
                value={form.partner_slug}
                onChange={(e) => set("partner_slug", e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-inkSoft">
              Affiliate / Campaign ID (opsional)
              <input
                className="input-flat mt-1.5"
                placeholder="ews_tiket_01"
                value={form.affiliate_id}
                onChange={(e) => set("affiliate_id", e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-inkSoft">
              MiniApp Production Base URL (opsional)
              <input
                className="input-flat mt-1.5"
                placeholder="https://aff.tiket.com"
                value={form.miniapp_production_base_url}
                onChange={(e) => set("miniapp_production_base_url", e.target.value)}
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-inkSoft">
            Campaign URL Template (opsional · placeholder: {"{target_url}"}, {"{affiliate_id}"}, {"{sub_id}"})
            <input
              className="input-flat mt-1.5 font-mono text-xs"
              placeholder="https://www.tiket.com/... atau wrapper resmi"
              value={form.campaign_url_template}
              onChange={(e) => set("campaign_url_template", e.target.value)}
            />
          </label>

          <section className="border-t border-line pt-4 space-y-4">
            <div>
              <h2 className="font-display text-lg text-ink">{copy.affiliateSecretsTitle}</h2>
              <p className="text-xs text-inkSoft mt-1">{copy.apiKeyHint}</p>
            </div>

            {SECRET_FIELDS.map((field) => {
              const actionKey = `${field.key}_action`;
              const stored = Boolean(serverConfig[field.hasKey]);
              return (
                <div key={field.key} className="rounded-xl border border-line p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink">
                      {lang === "en" ? field.labelEn : field.labelId}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        stored ? "bg-emerald-50 text-emerald-800" : "bg-cream text-inkSoft"
                      }`}
                    >
                      {stored ? copy.keyReady : copy.noKey}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {[
                      ["preserve", copy.keepKey],
                      ["replace", copy.replaceKey],
                      ["remove", copy.removeKey],
                    ].map(([actionValue, label]) => (
                      <label key={actionValue} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={actionKey}
                          checked={form[actionKey] === actionValue}
                          onChange={() => set(actionKey, actionValue)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {form[actionKey] === "replace" &&
                    (field.multiline ? (
                      <textarea
                        className="input-flat font-mono text-xs min-h-[96px]"
                        placeholder="-----BEGIN PUBLIC KEY-----"
                        value={form[field.key]}
                        onChange={(e) => set(field.key, e.target.value)}
                      />
                    ) : (
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="input-flat font-mono text-xs"
                        placeholder={copy.newKey}
                        value={form[field.key]}
                        onChange={(e) => set(field.key, e.target.value)}
                      />
                    ))}
                </div>
              );
            })}
          </section>

          <label className="block text-xs font-semibold text-inkSoft">
            Allowed Redirect Hosts (1 host per baris)
            <textarea
              className="input-flat mt-1.5 font-mono text-xs min-h-[84px]"
              value={form.allowed_redirect_hosts_text}
              onChange={(e) => set("allowed_redirect_hosts_text", e.target.value)}
            />
          </label>

          <FormActions
            onCancel={() => {
              const reset = createFormState(serverConfig);
              setForm(reset);
              setInitial(JSON.stringify(reset));
            }}
            saving={saveMutation.isPending}
            disabled={!dirty}
            saveLabel={copy.saveAffiliate}
          />
        </form>

        <aside className="space-y-5">
          <section className="card-flat p-5 space-y-4">
            <h2 className="font-display text-lg text-ink">{copy.affiliatePreviewTitle}</h2>
            <p className="text-xs text-inkSoft">{copy.affiliatePreviewSub}</p>
            <div className="grid gap-3">
              <label className="text-xs font-semibold text-inkSoft">
                Zona Sumut
                <select
                  className="input-flat mt-1"
                  value={previewZone}
                  onChange={(e) => setPreviewZone(e.target.value)}
                >
                  {SUMUT_ZONES.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-inkSoft">
                Vertikal
                <select
                  className="input-flat mt-1"
                  value={previewProduct}
                  onChange={(e) => setPreviewProduct(e.target.value)}
                >
                  <option value="hotel">Hotel & Homestay</option>
                  <option value="flight">Tiket Pesawat</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs"
                  disabled={previewMutation.isPending}
                  onClick={() =>
                    previewMutation.mutate({
                      zone: previewZone,
                      product: previewProduct,
                      lang,
                      live_token_test: false,
                    })
                  }
                  data-testid="affiliate-preview-btn"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {copy.preview}
                </button>
                {serverConfig.mode === "miniapp" && (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={previewMutation.isPending || !serverConfig.ready_for_launch}
                    onClick={() =>
                      previewMutation.mutate({
                        zone: previewZone,
                        product: previewProduct,
                        lang,
                        live_token_test: true,
                      })
                    }
                    data-testid="affiliate-live-test-btn"
                  >
                    Test Live Token API
                  </button>
                )}
              </div>
            </div>

            {previewResult && (
              <div className="rounded-xl border border-line bg-cream/60 p-3.5 space-y-2 text-xs" data-testid="affiliate-preview-output">
                <div className="font-semibold text-ink">{previewResult.card.title}</div>
                <div className="text-inkSoft">{previewResult.card.subtitle}</div>
                <div className="font-mono text-[11px] break-all rounded bg-white p-2 border border-line">
                  {previewResult.preview_url}
                </div>
                <div className="text-[11px] text-inkSoft">sub_id: {previewResult.sub_id}</div>
                {previewResult.live_test_status !== "skipped" && (
                  <div
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                      previewResult.live_test_status === "ok"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {previewResult.live_test_message}
                  </div>
                )}
                {previewResult.preview_url.startsWith("https://") &&
                  !previewResult.preview_url.includes("<miniapp_jwt_token>") && (
                    <a
                      href={previewResult.preview_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-flex items-center gap-1 font-semibold text-toba hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Buka URL preview
                    </a>
                  )}
              </div>
            )}
          </section>

          <section className="card-flat p-5 space-y-3">
            <h2 className="font-display text-lg text-ink">{copy.affiliateTopZones}</h2>
            {analytics?.by_zone?.length ? (
              <ul className="space-y-2 text-xs">
                {analytics.by_zone.slice(0, 6).map((row) => (
                  <li key={row.key} className="flex items-center justify-between border-b border-line/60 pb-1.5">
                    <span className="font-mono text-ink">{row.key}</span>
                    <span className="font-semibold text-toba">{row.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-inkSoft">{copy.affiliateNoClicks}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
