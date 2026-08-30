import React, { useEffect, useRef, useState } from "react";
import { useLang } from "../contexts/LanguageContext.jsx";
import { Sparkles, RefreshCw, Save, Shuffle, X, LogIn } from "lucide-react";
import UlosPattern from "../components/UlosPattern.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { renderMarkdown } from "../lib/markdown.jsx";
import PartnerCard from "../components/PartnerCard.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import { authUrl } from "../lib/authNavigation.js";
import { trackPlannerEvent } from "../lib/partnerAnalytics.js";
import { isTravelStyle, travelStyleFromLegacyBudget, travelStyleLabel } from "../lib/travelStyle.js";
import { extractPlannerPreferences, nextPlannerStep, PLANNER_NEXT_STEP } from "../lib/plannerPreferenceExtractor.js";
import PlannerWizard from "../components/Planner/PlannerWizard.jsx";
import PlannerResultGate from "../components/Planner/PlannerResultGate.jsx";
import PlannerResultCards from "../components/Planner/PlannerResultCards.jsx";
import StructuredPlannerResult, { PlannerGenerationError, PlannerResultProgress } from "../components/Planner/StructuredPlannerResult.jsx";
import Seo from "../components/Seo.jsx";
import {
  DEFAULT_PLANNER_RESULT_FEATURES,
  PLANNER_RESULT_FORMAT,
  isPlannerResultV2,
  normalizePlannerResultFeatures,
  plannerResultForStorage,
} from "../lib/plannerResultContract.js";
import { applyPlannerStreamEvent, consumePlannerSseStream, createPlannerStreamState } from "../lib/plannerStreamContract.js";
import usePlannerResultFocus from "../hooks/usePlannerResultFocus.js";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const PLANNER_DRAFT_KEY = "planner_draft_v2";
const PLANNER_DRAFT_SCHEMA_VERSION = 3;

function readPlannerDraft() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PLANNER_DRAFT_KEY) || "null");
    if (!parsed || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function plannerForm(value = {}) {
  const parsedDays = Number(value.days);
  const days = Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= 14 ? parsedDays : null;
  return {
    days,
    budget_style: isTravelStyle(value.budget_style)
      ? value.budget_style
      : value.budget != null
        ? travelStyleFromLegacyBudget(value.budget, days || 1)
        : null,
    interests: Array.isArray(value.interests) ? value.interests : [],
    extra_context: value.extra_context || "",
    preferred_destination_ids: value.preferred_destination_ids || [],
  };
}

export default function Planner() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const restoredDraft = readPlannerDraft();
  const [form, setForm] = useState(() => plannerForm(restoredDraft?.form));
  const [output, setOutput] = useState(restoredDraft?.output || "");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [showSearchCard, setShowSearchCard] = useState(!(restoredDraft?.output || isPlannerResultV2(restoredDraft?.result)));
  const [quota, setQuota] = useState(null);
  const [authGate, setAuthGate] = useState(false);
  const [recommendations, setRecommendations] = useState(restoredDraft?.recommendations || []);
  const [destinationIds, setDestinationIds] = useState(restoredDraft?.destinationIds || []);
  const [plannerResult, setPlannerResult] = useState(() => isPlannerResultV2(restoredDraft?.result) ? restoredDraft.result : null);
  const [resultFormat, setResultFormat] = useState(() => isPlannerResultV2(restoredDraft?.result) ? PLANNER_RESULT_FORMAT.STRUCTURED : PLANNER_RESULT_FORMAT.LEGACY);
  const [plannerResultFeatures, setPlannerResultFeatures] = useState(DEFAULT_PLANNER_RESULT_FEATURES);
  const [preferredDestination, setPreferredDestination] = useState(null);
  const [wizardStep, setWizardStep] = useState(() => restoredDraft?.wizard?.step || "story");
  const [stepTrail, setStepTrail] = useState(() => restoredDraft?.wizard?.trail || []);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState("");
  const [analyticsConsentRevision, setAnalyticsConsentRevision] = useState(0);
  const [progressPhase, setProgressPhase] = useState("generating");
  const [focusResultRevision, setFocusResultRevision] = useState(0);
  const plannerAbortRef = useRef(null);
  const resultHeadingRef = useRef(null);
  const isAuth = Boolean(user && typeof user === "object");
  const nextPath = `/planner${window.location.search}`;
  const resultCardsEnabled = plannerResultFeatures.planner_result_cards?.enabled === true;
  const enhancedPartnerCardsEnabled = resultCardsEnabled
    && plannerResultFeatures.planner_partner_matches?.enabled === true;
  const culinaryCardsEnabled = plannerResultFeatures.planner_culinary?.enabled === true;

  useEffect(() => {
    let active = true;
    api.get("/experience/features")
      .then(({ data }) => {
        if (active) setPlannerResultFeatures(normalizePlannerResultFeatures(data));
      })
      .catch(() => {
        if (active) setPlannerResultFeatures(DEFAULT_PLANNER_RESULT_FEATURES);
      });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => () => plannerAbortRef.current?.abort(), []);

  usePlannerResultFocus(resultHeadingRef, focusResultRevision);

  const persistDraft = (
    draftOutput = output,
    draftRecommendations = recommendations,
    draftDestinationIds = destinationIds,
    draftForm = form,
    draftWizard = { step: wizardStep, trail: stepTrail },
    draftResult = plannerResult,
    draftResultFormat = resultFormat,
  ) => {
    sessionStorage.setItem(PLANNER_DRAFT_KEY, JSON.stringify({
      schemaVersion: PLANNER_DRAFT_SCHEMA_VERSION,
      savedAt: Date.now(),
      form: draftForm,
      output: draftOutput,
      recommendations: draftRecommendations,
      destinationIds: draftDestinationIds,
      wizard: draftWizard,
      result: draftResult,
      resultFormat: draftResultFormat,
    }));
  };

  useEffect(() => {
    const destinationId = params.get("dest");
    if (!destinationId) return;
    // Put the route context in the final request immediately; the detail fetch
    // below is only needed for its localized display label.
    setForm((current) => ({
      ...current,
      preferred_destination_ids: current.preferred_destination_ids?.includes(destinationId)
        ? current.preferred_destination_ids
        : [...(current.preferred_destination_ids || []), destinationId],
    }));
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
      setForm(plannerForm({
        days: data.days,
        budget_style: data.budget_style,
        budget: data.budget,
        interests: data.interests || [],
        extra_context: data.extra_context || "",
        preferred_destination_ids: [],
      }));
      setOutput(data.content || "");
      setDestinationIds(data.destination_ids || []);
      const restoredResult = isPlannerResultV2(data.structured_result) ? data.structured_result : null;
      setRecommendations(restoredResult?.partner_matches || []);
      setPlannerResult(restoredResult);
      setResultFormat(restoredResult ? PLANNER_RESULT_FORMAT.STRUCTURED : PLANNER_RESULT_FORMAT.LEGACY);
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

  useEffect(() => {
    const handleConsentChange = () => setAnalyticsConsentRevision((value) => value + 1);
    window.addEventListener("analytics-consent-change", handleConsentChange);
    return () => window.removeEventListener("analytics-consent-change", handleConsentChange);
  }, []);

  useEffect(() => {
    const handleAuthSuccess = () => setAuthGate(false);
    window.addEventListener("app-auth-success", handleAuthSuccess);
    return () => window.removeEventListener("app-auth-success", handleAuthSuccess);
  }, []);

  useEffect(() => {
    if (showSearchCard && !transitioning) {
      trackPlannerEvent("planner_step_shown", wizardStep);
    }
  }, [analyticsConsentRevision, showSearchCard, transitioning, wizardStep]);

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
    const parsed = Number(value);
    const days = Number.isInteger(parsed) && parsed >= 1 && parsed <= 14 ? parsed : null;
    setForm((current) => ({
      ...current,
      days,
    }));
  };

  const selectBudgetTier = (tier) => {
    setForm((current) => ({
      ...current,
      budget_style: tier,
    }));
  };

  const waitForWizardTransition = () => new Promise((resolve) => window.setTimeout(resolve, 420));

  const transitionToStep = async (nextStep, message, rememberCurrent = true) => {
    setTransitionMessage(message);
    setTransitioning(true);
    await waitForWizardTransition();
    if (rememberCurrent) setStepTrail((trail) => [...trail, wizardStep]);
    setWizardStep(nextStep);
    setTransitioning(false);
  };

  const startGeneration = async (values) => {
    setTransitionMessage(lang === "en" ? "Preparing your itinerary…" : "Menyiapkan itinerary Anda…");
    setTransitioning(true);
    await waitForWizardTransition();
    setTransitioning(false);
    generate(null, false, values);
  };

  const submitStory = async (event) => {
    event.preventDefault();
    trackPlannerEvent("planner_story_submitted", "story");
    trackPlannerEvent("planner_step_completed", "story");
    const extracted = extractPlannerPreferences(form.extra_context);
    const values = {
      ...form,
      days: extracted.days,
      budget_style: extracted.budget_style,
      interests: extracted.interests,
      extra_context: form.extra_context.trim(),
    };
    setForm(values);
    const nextStep = nextPlannerStep(values);
    if (nextStep === PLANNER_NEXT_STEP.GENERATE) {
      await startGeneration(values);
      return;
    }
    await transitionToStep(
      nextStep,
      lang === "en" ? "Preparing the next question…" : "Menyiapkan pertanyaan berikutnya…",
    );
  };

  const submitBasics = async (event) => {
    event.preventDefault();
    if (!Number.isInteger(form.days) || form.days < 1 || form.days > 14 || !isTravelStyle(form.budget_style)) return;
    trackPlannerEvent("planner_step_completed", "basics");
    const nextStep = nextPlannerStep(form);
    if (nextStep === PLANNER_NEXT_STEP.GENERATE) {
      await startGeneration(form);
      return;
    }
    await transitionToStep(
      nextStep,
      lang === "en" ? "Preparing your interests…" : "Menyiapkan pilihan minat Anda…",
    );
  };

  const submitInterests = async (event) => {
    event.preventDefault();
    if (form.interests.length) {
      trackPlannerEvent("planner_step_completed", "interests");
      await startGeneration(form);
    }
  };

  const goBackInWizard = async () => {
    const previous = stepTrail[stepTrail.length - 1] || "story";
    setTransitionMessage(lang === "en" ? "Returning to the previous step…" : "Kembali ke langkah sebelumnya…");
    setTransitioning(true);
    await waitForWizardTransition();
    setStepTrail((trail) => trail.slice(0, -1));
    setWizardStep(previous);
    setTransitioning(false);
  };

  const generate = async (e, regenerate = false, requestForm = form) => {
    if (e) e.preventDefault();
    if (guestQuotaUsed) {
      showAuthenticationGate();
      return;
    }

    // Hide search card on first generation only
    if (!regenerate && showSearchCard) {
      setShowSearchCard(false);
    }

    // Reset and start loading state
    const previousPlan = regenerate ? {
      output,
      recommendations,
      destinationIds,
      result: plannerResult,
      resultFormat,
    } : null;
    const previous = previousPlan?.output || "";
    setOutput("");
    setRecommendations([]);
    setDestinationIds([]);
    setPlannerResult(null);
    setResultFormat(PLANNER_RESULT_FORMAT.LEGACY);
    setError("");
    setSavedId(null);
    setShowSave(false);
    setRerolling(regenerate);
    setStreaming(true);
    setProgressPhase("generating");
    plannerAbortRef.current?.abort();
    const controller = new AbortController();
    plannerAbortRef.current = controller;
    let streamState = createPlannerStreamState();

    try {
      const res = await fetch(`${BACKEND_URL}/api/trip-planner/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({ ...requestForm, lang, previous_content: previous.slice(0, 20000) }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail || {};
        if (["guest_trial_used", "authentication_required", "guest_network_limit_reached"].includes(detail.code)) {
          setQuota((current) => ({ ...(current || {}), remaining: 0, login_required: true }));
          showAuthenticationGate();
        } else if (detail.code === "planner_out_of_scope") {
          setShowSearchCard(true);
          setWizardStep("story");
          setStepTrail([]);
          setError(detail.message || t.planner.outOfScope);
        } else {
          setError(detail.message || (typeof detail === "string" ? detail : t.planner.startError));
        }
        return;
      }

      const streamOutcome = await consumePlannerSseStream(res.body, (evt) => {
        streamState = applyPlannerStreamEvent(streamState, evt);
        if (typeof evt.text === "string") setOutput(streamState.output);
        if (evt.recommendations) setRecommendations(streamState.recommendations);
        if (evt.destination_ids) setDestinationIds(streamState.destinationIds);
        if (evt.progress) setProgressPhase(streamState.progressPhase);
        if (streamState.result && isPlannerResultV2(evt.result)) {
          setPlannerResult(streamState.result);
          setResultFormat(streamState.resultFormat);
        } else if (evt.result_format === PLANNER_RESULT_FORMAT.LEGACY) {
          setPlannerResult(null);
          setResultFormat(PLANNER_RESULT_FORMAT.LEGACY);
        }
        if (evt.done === true) setFocusResultRevision((value) => value + 1);
        if (streamState.error) setError(streamState.error);
      });
      if (!streamOutcome.completed && !streamState.error) {
        throw new Error(t.planner.connectionInterrupted);
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        streamState = previousPlan ? {
          ...createPlannerStreamState(),
          output: previousPlan.output,
          recommendations: previousPlan.recommendations,
          destinationIds: previousPlan.destinationIds,
          result: previousPlan.result,
          resultFormat: previousPlan.resultFormat,
        } : createPlannerStreamState();
        setOutput(streamState.output);
        setRecommendations(streamState.recommendations);
        setDestinationIds(streamState.destinationIds);
        setPlannerResult(streamState.result);
        setResultFormat(streamState.resultFormat);
        setError(t.planner.generationCancelled);
      } else {
        setError(error.message);
      }
    } finally {
      if (plannerAbortRef.current === controller) plannerAbortRef.current = null;
      setStreaming(false);
      setRerolling(false);
      if (streamState.output) {
        persistDraft(
          streamState.output,
          streamState.recommendations,
          streamState.destinationIds,
          requestForm,
          { step: "result", trail: [] },
          streamState.result,
          streamState.resultFormat,
        );
        if (streamState.completed) trackPlannerEvent("planner_generated", "result");
      }
    }
  };

  const cancelGeneration = () => plannerAbortRef.current?.abort();

  const reset = () => {
    const nextForm = plannerForm({
      preferred_destination_ids: preferredDestination ? [preferredDestination.id] : [],
    });
    setOutput("");
    setError("");
    setSavedId(null);
    setShowSave(false);
    setSaveTitle("");
    setRecommendations([]);
    setDestinationIds([]);
    setPlannerResult(null);
    setResultFormat(PLANNER_RESULT_FORMAT.LEGACY);
    setForm(nextForm);
    setWizardStep("story");
    setStepTrail([]);
    setTransitioning(false);
    setShowSearchCard(true);
    sessionStorage.removeItem(PLANNER_DRAFT_KEY);
  };

  const requestNewPlan = () => {
    reset();
  };

  const saveTrip = async () => {
    if (!user || typeof user !== "object") {
      showAuthenticationGate();
      return;
    }
    setSaving(true);
    try {
      const storedResult = plannerResultForStorage(plannerResult);
      const title =
        saveTitle.trim() ||
        `${form.days} ${lang === "en" ? "days" : "hari"} · ${new Date().toLocaleDateString()}`;
      const { data } = await api.post("/itineraries", {
        title,
        days: form.days,
        budget_style: form.budget_style,
        interests: form.interests,
        content: output,
        lang,
        destination_ids: destinationIds,
        extra_context: form.extra_context,
        result_version: storedResult ? 2 : null,
        structured_result: storedResult,
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
      <Seo title={t.planner.title} description={t.planner.subtitle} path="/planner" />
      <header className="relative overflow-hidden pb-24 pt-7 sm:pb-28 sm:pt-10">
        <div className="absolute inset-0 text-cream/[0.08]">
          <UlosPattern />
        </div>
        <div className="app-gutter relative mx-auto max-w-4xl">
          {/* <div className="inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cream/85 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> {t.planner.tagline}
          </div> */}
          {/* <h1 className="mt-4 max-w-xl font-display text-[32px] leading-[1.05] text-cream sm:text-4xl lg:text-5xl">{t.planner.title}</h1> */}
          {/* <p className="mt-3 max-w-xl text-sm leading-6 text-cream/75">{t.planner.subtitle}</p> */}
        </div>
      </header>

      <div className="app-gutter relative mx-auto -mt-16 flex min-h-[calc(100dvh-232px)] max-w-4xl flex-col items-center pb-16 sm:-mt-20 md:pb-24">
        {showSearchCard && (
          <section className="planner-form-card responsive-card-pad w-full overflow-hidden rounded-[22px] border border-white/50 bg-surface/95 shadow-[0_20px_55px_rgba(5,31,31,0.24)] backdrop-blur-xl sm:rounded-[28px]">
            {!isAuth && quota && (
              <div
                className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${guestQuotaUsed ? "border-amber-300 bg-amber-50 text-amber-900" : "border-toba/20 bg-toba/5 text-ink"}`}
                data-testid="planner-guest-quota"
              >
                <p className="font-semibold">{guestQuotaUsed ? t.planner.trialUsed : t.planner.freeTrial}</p>
                {guestQuotaUsed && <button type="button" onClick={showAuthenticationGate} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-toba underline underline-offset-2"><LogIn className="h-3.5 w-3.5" /> {t.planner.continueLogin}</button>}
              </div>
            )}
            <PlannerWizard
              step={wizardStep}
              transitioning={transitioning}
              transitionMessage={transitionMessage}
              form={form}
              lang={lang}
              t={t}
              preferredDestination={preferredDestination}
              onStoryChange={(extra_context) => setForm((current) => ({ ...current, extra_context }))}
              onStorySubmit={submitStory}
              onDaysChange={updateDays}
              onStyleChange={selectBudgetTier}
              onInterestToggle={toggleInterest}
              onBasicsSubmit={submitBasics}
              onInterestsSubmit={submitInterests}
              onBack={goBackInWizard}
              onRemovePreferred={removePreferredDestination}
            />
          </section>
        )}

        {/* Floating Action Buttons - Show only when search card is hidden */}
        {!showSearchCard && (
          <div className="print-hidden fixed inset-x-0 bottom-[calc(5rem+max(0.625rem,env(safe-area-inset-bottom)))] z-40 mx-auto flex w-fit max-w-[calc(100%-1.75rem)] gap-2 rounded-2xl border border-white/50 bg-surface/95 p-2 shadow-[0_12px_35px_rgba(5,31,31,0.22)] backdrop-blur-xl md:bottom-6" style={{ maxHeight: 'calc(100dvh - 180px)', overflow: 'auto' }}>
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
          <PlannerGenerationError
            message={error}
            retryLabel={t.planner.retryGeneration}
            onRetry={!showSearchCard && !streaming ? () => generate(null, false) : null}
          />
        )}

        {(output || streaming) && (
          <article className="print-area mt-5 w-full overflow-hidden rounded-[28px] border border-white/60 bg-surface shadow-[0_18px_48px_rgba(5,31,31,0.12)]" data-testid="planner-output">
            <div className="flex flex-wrap items-start justify-between gap-3 bg-toba px-5 py-4 text-cream sm:px-7 sm:py-5">
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/65">{t.planner.tagline}</div><h2 ref={resultHeadingRef} tabIndex={-1} className="mt-1 rounded font-display text-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cream">{t.planner.itineraryTitle}</h2>{!streaming && <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-cream/80"><span className="rounded-full border border-cream/20 px-2 py-1">{form.days} {lang === "en" ? "days" : "hari"}</span><span className="rounded-full border border-cream/20 px-2 py-1">{travelStyleLabel(form.budget_style, lang)}</span>{form.interests.slice(0, 3).map((interest) => <span key={interest} className="rounded-full border border-cream/20 px-2 py-1">{t.categories[interest]}</span>)}</div>}</div>
              {!streaming && output && !savedId && (
                <div className="print-hidden flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
                <span className="print-hidden badge-moss" data-testid="save-success-badge">
                  ✓ {t.savedTrips.saved}
                </span>
              )}
              {!streaming && output && <button type="button" onClick={() => { setShowSearchCard(true); setWizardStep("story"); setStepTrail([]); }} className="print-hidden btn-outline w-full sm:w-auto"><Sparkles className="h-4 w-4" />{t.planner.editPreferences}</button>}
            </div>
            <div className="px-4 pb-28 pt-4 sm:px-7 sm:pt-7 md:pb-7">
            {streaming && (
              <PlannerResultProgress phase={progressPhase} t={t} onCancel={cancelGeneration} />
            )}
            {!streaming && output && <PlannerResultGate
              features={plannerResultFeatures}
              result={plannerResult}
              renderStructured={(result) => <StructuredPlannerResult
                result={result}
                lang={lang}
                t={t}
                destinationCardsEnabled={resultCardsEnabled}
                partnerMatchesEnabled={enhancedPartnerCardsEnabled}
                culinaryEnabled={culinaryCardsEnabled}
              />}
            >
              <div className="max-w-none">{renderMarkdown(output)}</div>

              <PlannerResultCards
                enabled={resultCardsEnabled}
                ready
                partnerMatchesEnabled={enhancedPartnerCardsEnabled}
                culinaryEnabled={culinaryCardsEnabled}
                destinationIds={destinationIds}
                recommendations={recommendations}
                t={t}
              />

              {recommendations.length > 0 && !enhancedPartnerCardsEnabled && (
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
                        <PartnerCard partner={recommendation.partner} source="planner" destinationId={recommendation.destination_id} analyticsContext={recommendation} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </PlannerResultGate>}
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
