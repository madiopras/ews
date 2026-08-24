import React, { useEffect, useState } from "react";
import { useLang } from "../contexts/LanguageContext.jsx";
import { CATEGORY_KEYS } from "../lib/i18n.js";
import { Sparkles, Compass, Wallet, Calendar, RefreshCw, Save, Shuffle, Loader2, X, LogIn } from "lucide-react";
import UlosPattern from "../components/UlosPattern.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { renderMarkdown } from "../lib/markdown.jsx";
import PartnerCard from "../components/PartnerCard.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import { authUrl } from "../lib/authNavigation.js";
import { trackPartnerEvent } from "../lib/partnerAnalytics.js";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const PLANNER_DRAFT_KEY = "planner_draft_v2";
const BUDGET_DAILY_TARGETS = {
  budget: 350000,
  mid_range: 750000,
  luxury: 1500000,
};

function totalForBudgetTier(tier, days) {
  return BUDGET_DAILY_TARGETS[tier] * Math.max(1, Number(days) || 1);
}

function tierFromBudget(budget, days) {
  const dailyBudget = (Number(budget) || 0) / Math.max(1, Number(days) || 1);
  return Object.keys(BUDGET_DAILY_TARGETS).reduce((closestTier, tier) => (
    Math.abs(BUDGET_DAILY_TARGETS[tier] - dailyBudget) < Math.abs(BUDGET_DAILY_TARGETS[closestTier] - dailyBudget)
      ? tier
      : closestTier
  ), "mid_range");
}

function readPlannerDraft() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PLANNER_DRAFT_KEY) || "null");
    if (!parsed || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function Planner() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const restoredDraft = readPlannerDraft();
  const [form, setForm] = useState(restoredDraft?.form || {
    days: 3,
    budget: totalForBudgetTier("mid_range", 3),
    interests: ["nature"],
    extra_context: "",
    preferred_destination_ids: [],
  });
  const [output, setOutput] = useState(restoredDraft?.output || "");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [showSearchCard, setShowSearchCard] = useState(!restoredDraft?.output);
  const [quota, setQuota] = useState(null);
  const [authGate, setAuthGate] = useState(false);
  const [recommendations, setRecommendations] = useState(restoredDraft?.recommendations || []);
  const [destinationIds, setDestinationIds] = useState(restoredDraft?.destinationIds || []);
  const [preferredDestination, setPreferredDestination] = useState(null);
  const [budgetTier, setBudgetTier] = useState(() => tierFromBudget(
    restoredDraft?.form?.budget || totalForBudgetTier("mid_range", 3),
    restoredDraft?.form?.days || 3,
  ));
  const isAuth = Boolean(user && typeof user === "object");
  const nextPath = `/planner${window.location.search}`;
  const budgetCopy = lang === "en"
    ? {
      title: "Travel style",
      hint: "This guides the plan, not a fixed price.",
      options: [
        { value: "budget", label: "Budget", description: "Essential experiences" },
        { value: "mid_range", label: "Mid-range", description: "Comfortable balance" },
        { value: "luxury", label: "Luxury", description: "More premium comfort" },
      ],
    }
    : {
      title: "Gaya budget",
      hint: "Ini menjadi panduan rencana, bukan harga pasti.",
      options: [
        { value: "budget", label: "Hemat", description: "Pengalaman esensial" },
        { value: "mid_range", label: "Nyaman", description: "Seimbang dan fleksibel" },
        { value: "luxury", label: "Mewah", description: "Kenyamanan lebih premium" },
      ],
    };

  useEffect(() => {
    if (streaming || recommendations.length === 0) return;
    recommendations.forEach(item => trackPartnerEvent("ai_impression", item.partner_id, "planner", item.destination_id));
  }, [streaming, recommendations]);

  // Loading animation states
  const [loadingStage, setLoadingStage] = useState(0);
  const phrases = [
    "sedang membuat",
    "sedang menyusun",
    "sedang merakit",
    "sedang menyiapkan",
    "sedang merencanakan",
    "sedang mengatur"
  ];

  const persistDraft = (draftOutput = output, draftRecommendations = recommendations, draftDestinationIds = destinationIds) => {
    sessionStorage.setItem(PLANNER_DRAFT_KEY, JSON.stringify({
      savedAt: Date.now(),
      form,
      output: draftOutput,
      recommendations: draftRecommendations,
      destinationIds: draftDestinationIds,
    }));
  };

  const refreshQuota = () => api.get("/planner/quota")
    .then(({ data }) => setQuota(data))
    .catch(() => setQuota(null));

  useEffect(() => {
    refreshQuota();
  }, [user]);

  useEffect(() => {
    const destinationId = params.get("dest");
    if (!destinationId) return;
    api.get(`/destinations/${destinationId}`)
      .then(({ data }) => {
        const displayName = lang === "en" && data.name_en ? data.name_en : data.name;
        setPreferredDestination({ id: data.id, name: displayName });
        setForm((current) => ({
          ...current,
          preferred_destination_ids: current.preferred_destination_ids?.includes(data.id)
            ? current.preferred_destination_ids
            : [...(current.preferred_destination_ids || []), data.id],
        }));
      })
      .catch(() => {
        setPreferredDestination(null);
        setForm((current) => ({ ...current, preferred_destination_ids: [] }));
        setError(t.planner.invalidDestination);
      });
  }, [lang, params, t.planner.invalidDestination]);

  const sourceItineraryId = params.get("itinerary") || "";
  useEffect(() => {
    if (!sourceItineraryId || !isAuth) return;
    api.get(`/itineraries/${sourceItineraryId}`).then(({ data }) => {
      setForm({
        days: data.days,
        budget: data.budget,
        interests: data.interests || [],
        extra_context: data.extra_context || "",
        preferred_destination_ids: [],
      });
      setBudgetTier(tierFromBudget(data.budget, data.days));
      setOutput(data.content || "");
      setDestinationIds(data.destination_ids || []);
      setRecommendations([]);
      setShowSearchCard(false);
      setSavedId(null);
      setError("");
    }).catch(() => setError(t.savedTrips.loadError));
  }, [isAuth, sourceItineraryId, t.savedTrips.loadError]);

  const showAuthenticationGate = () => {
    persistDraft();
    setAuthGate(true);
  };

  const guestQuotaUsed = !isAuth && quota?.remaining === 0;

  const removePreferredDestination = () => {
    setPreferredDestination(null);
    setForm((current) => ({ ...current, preferred_destination_ids: [] }));
    const nextParams = new URLSearchParams(params);
    nextParams.delete("dest");
    setParams(nextParams, { replace: true });
  };

  const toggleInterest = (cat) => {
    setForm((p) => ({
      ...p,
      interests: p.interests.includes(cat)
        ? p.interests.filter((c) => c !== cat)
        : [...p.interests, cat],
    }));
  };

  const updateDays = (value) => {
    const days = Math.max(1, Number(value) || 1);
    setForm((current) => ({
      ...current,
      days,
      budget: totalForBudgetTier(budgetTier, days),
    }));
  };

  const selectBudgetTier = (tier) => {
    setBudgetTier(tier);
    setForm((current) => ({
      ...current,
      budget: totalForBudgetTier(tier, current.days),
    }));
  };

  const generate = async (e, regenerate = false) => {
    if (e) e.preventDefault();
    if (guestQuotaUsed) {
      showAuthenticationGate();
      return;
    }

    // Hide search card on first generation only
    if (!regenerate && showSearchCard) {
      setShowSearchCard(false);
    }

    // Reset and start loading animation
    setLoadingStage(0);
    const previous = regenerate ? output : "";
    setOutput("");
    setRecommendations([]);
    setDestinationIds([]);
    setError("");
    setSavedId(null);
    setShowSave(false);
    setRerolling(regenerate);
    setStreaming(true);
    let streamedOutput = "";
    let streamedRecommendations = [];
    let streamedDestinationIds = [];

    try {
      const res = await fetch(`${BACKEND_URL}/api/trip-planner/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, lang, previous_content: previous.slice(0, 20000) }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail || {};
        if (["guest_trial_used", "authentication_required", "guest_network_limit_reached"].includes(detail.code)) {
          setQuota((current) => ({ ...(current || {}), remaining: 0, login_required: true }));
          showAuthenticationGate();
        } else {
          setError(detail.message || (typeof detail === "string" ? detail : t.planner.startError));
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const chunk of parts) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.text) {
              streamedOutput += evt.text;
              setOutput((prev) => prev + evt.text);
            }
            if (evt.recommendations) {
              streamedRecommendations = evt.recommendations;
              setRecommendations(evt.recommendations);
            }
            if (evt.destination_ids) {
              streamedDestinationIds = evt.destination_ids;
              setDestinationIds(evt.destination_ids);
            }
            if (evt.error) setError(evt.error);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setStreaming(false);
      setRerolling(false);
      if (streamedOutput) {
        persistDraft(streamedOutput, streamedRecommendations, streamedDestinationIds);
        refreshQuota();
      }
    }
  };

  // Loading animation effect
  React.useEffect(() => {
    let interval;
    if (streaming && !output) {
      interval = setInterval(() => {
        setLoadingStage((prev) => (prev + 1) % phrases.length);
      }, 800); // Change word every 800ms
    }
    return () => clearInterval(interval);
  }, [streaming, output, phrases.length]);

  const reset = () => {
    setOutput("");
    setError("");
    setSavedId(null);
    setShowSave(false);
    setSaveTitle("");
    setRecommendations([]);
    setDestinationIds([]);
    setShowSearchCard(true); // Show search card again
    sessionStorage.removeItem(PLANNER_DRAFT_KEY);
  };

  const requestNewPlan = () => {
    if (guestQuotaUsed) {
      showAuthenticationGate();
      return;
    }
    reset();
  };

  const saveTrip = async () => {
    if (!user || typeof user !== "object") {
      showAuthenticationGate();
      return;
    }
    setSaving(true);
    try {
      const title =
        saveTitle.trim() ||
        `${form.days} ${lang === "en" ? "days" : "hari"} · ${new Date().toLocaleDateString()}`;
      const { data } = await api.post("/itineraries", {
        title,
        days: form.days,
        budget: form.budget,
        interests: form.interests,
        content: output,
        lang,
        destination_ids: destinationIds,
        extra_context: form.extra_context,
      });
      setSavedId(data.id);
      setShowSave(false);
      sessionStorage.removeItem(PLANNER_DRAFT_KEY);
      toast.success(t.savedTrips.saved);
    } catch {
      toast.error(t.common.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="planner-page" className="planner-workspace min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_80%_0%,rgba(139,157,131,0.22),transparent_31%),linear-gradient(180deg,#0a2b2c_0,#0f3d3e_280px,#f5f1e8_280px)]">
      <header className="relative overflow-hidden pb-24 pt-7 sm:pb-28 sm:pt-10">
        <div className="absolute inset-0 text-cream/[0.08]">
          <UlosPattern />
        </div>
        <div className="relative mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
          {/* <div className="inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cream/85 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> {t.planner.tagline}
          </div> */}
          {/* <h1 className="mt-4 max-w-xl font-display text-[32px] leading-[1.05] text-cream sm:text-4xl lg:text-5xl">{t.planner.title}</h1> */}
          {/* <p className="mt-3 max-w-xl text-sm leading-6 text-cream/75">{t.planner.subtitle}</p> */}
        </div>
      </header>

      <div className="relative mx-auto -mt-16 flex min-h-[calc(100vh-232px)] max-w-4xl flex-col items-center px-4 pb-36 sm:-mt-20 sm:px-6 md:pb-24 lg:px-8">
        {showSearchCard && (
          <form onSubmit={generate} className="planner-form-card w-full overflow-hidden rounded-[28px] border border-white/50 bg-surface/95 p-4 shadow-[0_20px_55px_rgba(5,31,31,0.24)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 rounded-2xl bg-[linear-gradient(135deg,rgba(15,61,62,0.11),rgba(139,157,131,0.20))] px-4 py-4 sm:mb-6 sm:px-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-toba text-cream shadow-lg shadow-toba/20"><Sparkles className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold leading-snug text-ink sm:text-lg">{t.planner.agentReady}</h2>
                  {/* <p className="mt-1 text-xs leading-5 text-inkSoft">{t.planner.subtitle}</p> */}
                </div>
              </div>
            </div>

            {!isAuth && quota && (
              <div
                className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${guestQuotaUsed ? "border-amber-300 bg-amber-50 text-amber-900" : "border-toba/20 bg-toba/5 text-ink"}`}
                data-testid="planner-guest-quota"
              >
                <p className="font-semibold">
                  {guestQuotaUsed ? t.planner.trialUsed : t.planner.freeTrial}
                </p>
                {guestQuotaUsed && (
                  <button type="button" onClick={showAuthenticationGate} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-toba underline underline-offset-2">
                    <LogIn className="h-3.5 w-3.5" /> {t.planner.continueLogin}
                  </button>
                )}
              </div>
            )}

            {preferredDestination && (
              <div className="mb-5 rounded-xl border border-moss/30 bg-moss/10 px-4 py-3" data-testid="planner-preferred-destination">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-inkSoft">{t.planner.preferredDestination}</p>
                    <p className="mt-1 font-semibold text-ink">{preferredDestination.name}</p>
                  </div>
                  <button type="button" onClick={removePreferredDestination} className="rounded-full p-2 text-inkSoft hover:bg-white" aria-label={t.planner.removePreferred}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Search Card - Content */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] sm:gap-4">
            <label className="planner-field block rounded-2xl border border-line/80 bg-cream/60 p-3 sm:p-0 sm:border-0 sm:bg-transparent">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-inkSoft sm:text-[13px] sm:normal-case sm:tracking-normal">
                <Calendar className="w-3.5 h-3.5" /> {t.planner.days}
              </span>
              <input
                type="number"
                min="1"
                max="14"
                required
                value={form.days}
                onChange={(e) => updateDays(e.target.value)}
                className="input-flat mt-2 bg-surface px-3 sm:px-4"
                data-testid="planner-days"
              />
            </label>
            <fieldset className="planner-field min-w-0 rounded-2xl border border-line/80 bg-cream/60 p-3 sm:border-0 sm:bg-transparent sm:p-0" data-testid="planner-budget">
              <legend className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-inkSoft sm:text-[13px] sm:normal-case sm:tracking-normal">
                <Wallet className="h-3.5 w-3.5" /> {budgetCopy.title}
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {budgetCopy.options.map((option) => {
                  const selected = budgetTier === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectBudgetTier(option.value)}
                      aria-pressed={selected}
                      className={`min-w-0 rounded-xl border px-2 py-2 text-center transition sm:px-3 ${selected ? "border-toba bg-toba text-cream shadow-sm" : "border-line bg-surface text-ink hover:border-toba/60"}`}
                    >
                      <span className="block text-[11px] font-semibold leading-tight sm:text-xs">{option.label}</span>
                      <span className={`mt-1 hidden text-[10px] leading-tight sm:block ${selected ? "text-cream/75" : "text-inkSoft"}`}>{option.description}</span>
                    </button>
                  );
                })}
              </div>
              {/* <p className="mt-2 text-[11px] leading-4 text-inkSoft">{budgetCopy.hint}</p> */}
            </fieldset>
          </div>

          <div className="mt-5">
            <span className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-inkSoft">
              <Compass className="w-3.5 h-3.5" /> {t.planner.interests}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {CATEGORY_KEYS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleInterest(cat)}
                  data-testid={`planner-interest-${cat}`}
                  className={`min-h-[48px] justify-start rounded-2xl px-3 text-left text-[12px] sm:min-h-[44px] sm:justify-center sm:rounded-full sm:px-4 sm:text-[13px] ${form.interests.includes(cat) ? "bg-toba text-cream font-semibold shadow-sm" : "border border-line bg-surface text-ink hover:border-toba"}`}
                >
                  {t.categories[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-inkSoft flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> {t.planner.extraContext}{" "}
                <span className="text-inkSoft/60">({t.planner.optional})</span>
              </span>
              <span className="text-[11px] text-inkSoft/70" data-testid="planner-ctx-count">
                {form.extra_context.length}/200
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={200}
              value={form.extra_context}
              onChange={(e) =>
                setForm((p) => ({ ...p, extra_context: e.target.value.slice(0, 200) }))
              }
              placeholder={t.planner.extraContextPlaceholder}
              className="input-flat resize-none bg-surface"
              data-testid="planner-extra-context"
            />
          </div>

          {/* Form actions (mobile and desktop - inside card) */}
          <div className="mt-6 flex justify-end border-t border-line/70 pt-4">
            <button type="submit" disabled={streaming} className="btn-primary w-full rounded-2xl shadow-lg shadow-brick/20 sm:w-auto" data-testid="planner-generate-btn">
              <Sparkles className="w-4 h-4" />
              {streaming && !rerolling ? t.planner.generating : t.planner.generate}
            </button>
          </div>

          {/* Desktop actions */}
          <div className="mt-6 hidden md:flex gap-3">
            {output && !streaming && (
              <button
                type="button"
                onClick={() => generate(null, true)}
                className="btn-outline"
                data-testid="planner-reroll-btn"
              >
                <Shuffle className="w-4 h-4" /> {t.planner.regenerate}
              </button>
            )}
            {(output || error) && !streaming && (
              <button type="button" onClick={requestNewPlan} className="btn-outline" data-testid="planner-reset-btn">
                <RefreshCw className="w-4 h-4" /> {t.planner.newPlan}
              </button>
            )}
          </div>
        </form>
        )}

        {/* Floating Action Buttons - Show only when search card is hidden */}
        {!showSearchCard && (
          <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] gap-2 rounded-2xl border border-white/50 bg-surface/95 p-2 shadow-[0_12px_35px_rgba(5,31,31,0.22)] backdrop-blur-xl md:bottom-6" style={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
            <button
              type="button"
              onClick={requestNewPlan}
              disabled={streaming || rerolling}
              className="btn-outline min-h-[42px] px-3 text-xs sm:px-5 sm:text-sm"
            >
              <RefreshCw className="w-4 h-4" /> {t.planner.newPlan}
            </button>

            <button
              type="button"
              onClick={() => generate(null, true)}
              disabled={streaming || rerolling}
              className="btn-primary min-h-[42px] px-3 text-xs sm:px-5 sm:text-sm"
            >
              <Shuffle className="w-4 h-4" /> {t.planner.regenerate}
            </button>
          </div>
        )}

        {error && (
          <div
            className="mt-5 w-full rounded-2xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-700 shadow-sm"
            data-testid="planner-error"
          >
            {error}
          </div>
        )}

        {(output || streaming) && (
          <article className="mt-5 w-full overflow-hidden rounded-[28px] border border-white/60 bg-surface shadow-[0_18px_48px_rgba(5,31,31,0.12)]" data-testid="planner-output">
            <div className="flex flex-wrap items-start justify-between gap-3 bg-toba px-5 py-4 text-cream sm:px-7 sm:py-5">
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/65">{t.planner.tagline}</div><h2 className="mt-1 font-display text-2xl">{t.planner.itineraryTitle}</h2></div>
              {!streaming && output && !savedId && (
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  {showSave ? (
                    <>
                      <input
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                        placeholder={t.savedTrips.titlePlaceholder}
                        className="input-flat flex-1 min-w-[160px]"
                        data-testid="save-title-input"
                      />
                      <button
                        onClick={saveTrip}
                        disabled={saving}
                        className="btn-primary"
                        data-testid="save-confirm-btn"
                      >
                        {saving ? "..." : t.savedTrips.saveBtn}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => isAuth ? setShowSave(true) : showAuthenticationGate()}
                      className="btn-outline w-full sm:w-auto"
                      data-testid="save-trip-btn"
                    >
                      <Save className="w-4 h-4" /> {t.savedTrips.saveBtn}
                    </button>
                  )}
                </div>
              )}
              {savedId && (
                <span className="badge-moss" data-testid="save-success-badge">
                  ✓ {t.savedTrips.saved}
                </span>
              )}
            </div>
            <div className="p-4 sm:p-7">
            {streaming && !output && (
              <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-5 text-[13px] text-inkSoft">
                <Loader2 className="w-4 h-4 animate-spin-slow" />
                <span>
                  AI
                  <span className="font-semibold text-toba mx-1">
                    {phrases[loadingStage]}
                  </span>
                  liburan anda ....
                </span>
              </div>
            )}
            <div className="max-w-none">{renderMarkdown(output)}</div>

            {!streaming && recommendations.length > 0 && (
              <section className="mt-8 border-t border-line pt-6" data-testid="planner-partner-recommendations">
                <div className="mb-4">
                  <h2 className="font-display text-xl text-ink">{t.planner.recommendedPartners}</h2>
                  <p className="mt-1 text-[12px] text-inkSoft">{t.planner.organicMatch}</p>
                </div>
                <div className="space-y-4">
                  {recommendations.map((recommendation) => (
                    <div key={`${recommendation.destination_id}-${recommendation.partner_id}`}>
                      <p className="mb-2 text-[12px] text-inkSoft">
                        {t.planner.matches} <span className="font-semibold text-ink">{recommendation.destination_name}</span>
                        {recommendation.partner?.is_premium ? ` · ${t.planner.featuredDisclosure}` : ""}
                      </p>
                      <PartnerCard partner={recommendation.partner} source="planner" destinationId={recommendation.destination_id} />
                    </div>
                  ))}
                </div>
              </section>
            )}
            </div>
          </article>
        )}
      </div>

      {authGate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true" aria-labelledby="planner-auth-title" data-testid="planner-auth-gate">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button type="button" onClick={() => setAuthGate(false)} className="absolute right-4 top-4 rounded-full p-2 text-inkSoft hover:bg-cream" aria-label={t.common?.close || "Close"}>
              <X className="h-5 w-5" />
            </button>
            <Sparkles className="h-8 w-8 text-toba" />
            <h2 id="planner-auth-title" className="mt-4 font-display text-2xl text-ink">{t.planner.authGateTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-inkSoft">{t.planner.authGateDesc}</p>
            <div className="mt-5 space-y-3">
              <GoogleButton next={nextPath} />
              <Link to={authUrl("/login", nextPath, "planner_generate")} className="btn-primary flex w-full justify-center">
                <LogIn className="h-4 w-4" /> {t.planner.continueLogin}
              </Link>
              <Link to={authUrl("/register", nextPath, "planner_generate")} className="btn-outline flex w-full justify-center">
                {t.planner.continueRegister}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
