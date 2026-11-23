import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, EyeOff, KeyRound, SlidersHorizontal } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmActionDialog, FormActions } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { formatError } from "../../../lib/api.js";
import {
  createLlmProfile,
  getLlmProfile,
  listLlmProfiles,
  updateLlmProfile,
} from "./settingsApi.js";

const EMPTY = {
  name: "",
  base_url: "",
  model_name: "",
  enabled: true,
  api_key_action: "preserve",
  api_key: "",
  supports_json_mode: false,
  temperature: "",
  max_tokens: "",
  fallback_profile_id: "",
};

function parseOptionalNumber(raw, { integer = false } = {}) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return integer ? Math.trunc(num) : num;
}

export function buildLlmProfilePayload(form, editing) {
  const shared = {
    name: form.name,
    base_url: form.base_url,
    model_name: form.model_name,
    enabled: form.enabled,
    supports_json_mode: Boolean(form.supports_json_mode),
    temperature: parseOptionalNumber(form.temperature),
    max_tokens: parseOptionalNumber(form.max_tokens, { integer: true }),
    fallback_profile_id: String(form.fallback_profile_id || "").trim() || null,
  };
  if (editing) {
    return {
      ...shared,
      api_key_action: form.api_key_action,
      api_key: form.api_key_action === "replace" ? form.api_key : null,
    };
  }
  return {
    ...shared,
    api_key: form.api_key || null,
  };
}

export default function LlmProfileFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useLang();
  const copy = t.admin.settings;

  const query = useQuery({
    queryKey: ["admin", "llm", "profile", id],
    queryFn: ({ signal }) => getLlmProfile(id, signal),
    enabled: editing,
  });
  const allProfilesQuery = useQuery({
    queryKey: ["admin", "llm", "profiles", ""],
    queryFn: ({ signal }) => listLlmProfiles("", signal),
  });

  const [form, setForm] = useState(EMPTY);
  const [initial, setInitial] = useState(JSON.stringify(EMPTY));
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (query.data) {
      const value = {
        name: query.data.name,
        base_url: query.data.base_url,
        model_name: query.data.model_name,
        enabled: query.data.enabled,
        api_key_action: "preserve",
        api_key: "",
        supports_json_mode: Boolean(query.data.supports_json_mode),
        temperature: query.data.temperature != null ? String(query.data.temperature) : "",
        max_tokens: query.data.max_tokens != null ? String(query.data.max_tokens) : "",
        fallback_profile_id: query.data.fallback_profile_id || "",
      };
      setForm(value);
      setInitial(JSON.stringify(value));
    }
  }, [query.data]);

  const dirty = JSON.stringify(form) !== initial;
  useEffect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = buildLlmProfilePayload(form, editing);
      return editing ? updateLlmProfile(id, payload) : createLlmProfile(payload);
    },
    onSuccess: async () => {
      setInitial(JSON.stringify(form));
      await qc.invalidateQueries({ queryKey: ["admin", "llm"] });
      toast.success(copy.profileSaved);
      navigate("/admin/settings/llm");
    },
    onError: (e) => toast.error(formatError(e.response?.data?.detail || copy.saveError)),
  });

  const needsSecretConfirmation = editing && form.api_key_action !== "preserve";
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (e) => {
    e?.preventDefault();
    if (needsSecretConfirmation) setConfirmOpen(true);
    else mutation.mutate();
  };

  const keyOptions = useMemo(
    () => [
      { value: "preserve", label: copy.keepKey },
      { value: "replace", label: copy.replaceKey },
      { value: "remove", label: copy.removeKey },
    ],
    [copy],
  );

  const fallbackCandidates = useMemo(
    () => (allProfilesQuery.data || []).filter((profile) => profile.id !== id),
    [allProfilesQuery.data, id],
  );

  if (editing && query.isLoading) return <div className="p-8 text-inkSoft">Loading...</div>;
  if (editing && query.isError) return <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{copy.loadError}</div>;

  return (
    <div className="app-gutter w-full py-6 pb-16" data-testid="llm-profile-form-page">
      <header className="mb-5">
        <Link to="/admin/settings/llm" className="inline-flex gap-2 items-center text-xs text-inkSoft hover:text-toba">
          <ArrowLeft className="w-4 h-4" />{copy.back}
        </Link>
        <div className="eyebrow mt-4">Admin · LLM</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-4xl">{editing ? copy.edit : copy.addProfile}</h1>
      </header>
      <form onSubmit={submit} className="card-flat p-5 sm:p-6 max-w-4xl space-y-5">
        {editing && query.data?.active && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            {copy.activeEditWarning}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-xs font-semibold text-inkSoft">
            {copy.name}
            <input className="input-flat mt-1.5" required minLength="2" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="llm-name" />
          </label>
          <label className="text-xs font-semibold text-inkSoft">
            {copy.modelName}
            <input className="input-flat mt-1.5" required value={form.model_name} onChange={(e) => set("model_name", e.target.value)} placeholder="gpt-4.1-mini" data-testid="llm-model-name" />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold text-inkSoft">
            {copy.baseUrl}
            <input className="input-flat mt-1.5" required type="url" value={form.base_url} onChange={(e) => set("base_url", e.target.value)} placeholder="https://provider.example/v1" data-testid="llm-base-url" />
          </label>
        </div>

        <section className="rounded-xl border border-line p-4 space-y-4">
          <div className="flex gap-3">
            <span className="w-9 h-9 rounded-lg bg-line/30 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-semibold text-sm">{copy.advancedOptions}</h2>
              <p className="text-[11px] text-inkSoft mt-1">{copy.advancedOptionsHint}</p>
            </div>
          </div>

          <label className="flex gap-3 items-center text-sm">
            <input
              type="checkbox"
              className="w-4 h-4 accent-toba"
              checked={form.supports_json_mode}
              onChange={(e) => set("supports_json_mode", e.target.checked)}
              data-testid="llm-supports-json-mode"
            />
            <span>{copy.supportsJsonMode}</span>
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-inkSoft">
              {copy.temperature}
              <input
                className="input-flat mt-1.5"
                type="number"
                step="0.05"
                min="0"
                max="2"
                placeholder="0.4"
                value={form.temperature}
                onChange={(e) => set("temperature", e.target.value)}
                data-testid="llm-temperature"
              />
            </label>
            <label className="text-xs font-semibold text-inkSoft">
              {copy.maxTokens}
              <input
                className="input-flat mt-1.5"
                type="number"
                step="1"
                min="256"
                max="32768"
                placeholder="4096"
                value={form.max_tokens}
                onChange={(e) => set("max_tokens", e.target.value)}
                data-testid="llm-max-tokens"
              />
            </label>
            <label className="sm:col-span-2 text-xs font-semibold text-inkSoft">
              {copy.fallbackProfile}
              <select
                className="input-flat mt-1.5"
                value={form.fallback_profile_id}
                onChange={(e) => set("fallback_profile_id", e.target.value)}
                data-testid="llm-fallback-profile"
              >
                <option value="">{copy.fallbackNone}</option>
                {fallbackCandidates.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.model_name}){profile.enabled ? "" : ` · ${copy.disabled}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-line p-4 space-y-4">
          <div className="flex gap-3">
            <span className="w-9 h-9 rounded-lg bg-line/30 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-semibold text-sm">{copy.apiKey}</h2>
              <p className="text-[11px] text-inkSoft mt-1 flex gap-1.5">
                <EyeOff className="w-3.5 h-3.5" />{copy.apiKeyHint}
              </p>
            </div>
          </div>
          {editing ? (
            <div className="grid sm:grid-cols-3 gap-2">
              {keyOptions.map((option) => (
                <label key={option.value} className={`rounded-lg border p-3 text-xs cursor-pointer ${form.api_key_action === option.value ? "border-toba bg-toba/5" : "border-line"}`}>
                  <input
                    className="mr-2 accent-toba"
                    type="radio"
                    name="api_key_action"
                    value={option.value}
                    checked={form.api_key_action === option.value}
                    onChange={(e) => {
                      set("api_key_action", e.target.value);
                      if (e.target.value !== "replace") set("api_key", "");
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          ) : null}
          {(!editing || form.api_key_action === "replace") && (
            <label className="text-xs font-semibold text-inkSoft">
              {editing ? copy.newKey : copy.apiKey}
              <input
                className="input-flat mt-1.5"
                type="password"
                autoComplete="new-password"
                required={form.api_key_action === "replace"}
                value={form.api_key}
                onChange={(e) => set("api_key", e.target.value)}
              />
            </label>
          )}
        </section>

        <label className="flex gap-3 items-center text-sm">
          <input type="checkbox" className="w-4 h-4 accent-toba" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          {copy.enabled}
        </label>

        <FormActions
          onCancel={() => (dirty && !window.confirm(copy.unsaved) ? null : navigate("/admin/settings/llm"))}
          saving={mutation.isPending}
          disabled={!dirty}
          saveLabel={editing ? copy.save : copy.create}
        />
      </form>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={form.api_key_action === "remove" ? copy.removeKey : copy.replaceKey}
        description={copy.confirmSecretChange}
        confirmLabel={form.api_key_action === "remove" ? copy.removeKey : copy.replaceKey}
        destructive={form.api_key_action === "remove"}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    </div>
  );
}
