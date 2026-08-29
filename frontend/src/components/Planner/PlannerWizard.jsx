import React, { useEffect, useRef } from "react";
import { ArrowLeft, Calendar, Compass, Loader2, Sparkles, Wallet } from "lucide-react";
import { CATEGORY_KEYS } from "../../lib/i18n.js";
import { travelStyleOptions } from "../../lib/travelStyle.js";

const COPY = {
  id: {
    storyTitle: "Ceritakan perjalanan yang Anda inginkan",
    storyDescription: "Tuliskan suasana, teman perjalanan, atau tempat yang ingin dikunjungi. Fitur ini khusus menyusun perjalanan wisata Sumatera Utara.",
    storyPlaceholder: "Contoh: Saya ingin liburan 3 hari yang santai bersama keluarga, suka alam dan kuliner, dengan gaya nyaman.",
    examples: ["3 hari nyaman, alam dan kuliner", "Liburan keluarga yang santai", "Mau melihat air terjun dan danau"],
    planWithStory: "Bantu rencanakan",
    basicsTitle: "Berapa lama dan seperti apa perjalanan Anda?",
    basicsDescription: "Lengkapi yang belum tertangkap dari cerita Anda.",
    duration: "Durasi perjalanan",
    travelStyle: "Gaya perjalanan",
    chooseStyle: "Pilih gaya perjalanan",
    continue: "Lanjutkan",
    interestsTitle: "Apa yang ingin Anda nikmati?",
    interestsDescription: "Pilih satu atau beberapa minat agar itinerary lebih relevan.",
    create: "Buat itinerary",
    backToStory: "Kembali ke cerita",
    back: "Kembali",
    understanding: "Memahami cerita perjalanan Anda…",
    preparing: "Menyiapkan pertanyaan berikutnya…",
  },
  en: {
    storyTitle: "Tell us about the trip you want",
    storyDescription: "Describe the mood, your travel companions, or places you want to visit. This feature is only for planning North Sumatra trips.",
    storyPlaceholder: "Example: I want a relaxed 3-day family trip, love nature and food, with a mid-range travel style.",
    examples: ["3 days, mid-range, nature and food", "A relaxed family trip", "I want waterfalls and lakes"],
    planWithStory: "Help me plan",
    basicsTitle: "How long and what kind of trip is it?",
    basicsDescription: "Fill in only what was not clear from your story.",
    duration: "Trip duration",
    travelStyle: "Travel style",
    chooseStyle: "Choose a travel style",
    continue: "Continue",
    interestsTitle: "What would you like to enjoy?",
    interestsDescription: "Choose one or more interests for a more relevant itinerary.",
    create: "Create itinerary",
    backToStory: "Back to story",
    back: "Back",
    understanding: "Understanding your trip story…",
    preparing: "Preparing the next question…",
  },
};

const QUICK_DAYS = [1, 2, 3, 4, 5, 7];

export default function PlannerWizard({
  step,
  transitioning,
  transitionMessage,
  form,
  lang,
  t,
  preferredDestination,
  onStoryChange,
  onStorySubmit,
  onDaysChange,
  onStyleChange,
  onInterestToggle,
  onBasicsSubmit,
  onInterestsSubmit,
  onBack,
  onRemovePreferred,
}) {
  const copy = COPY[lang === "en" ? "en" : "id"];
  const options = travelStyleOptions(lang);
  const validDays = Number.isInteger(form.days) && form.days >= 1 && form.days <= 14;
  const validStyle = options.some((option) => option.value === form.budget_style);
  const stepHeadingRef = useRef(null);

  useEffect(() => {
    // The story field is the primary input and retains its autofocus. Subsequent
    // steps move focus to their heading so keyboard and screen-reader users know
    // that the wizard content has changed.
    if (!transitioning && step !== "story") stepHeadingRef.current?.focus();
  }, [step, transitioning]);

  if (transitioning) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center px-2 text-center sm:min-h-[330px] sm:px-5" role="status" aria-live="polite" data-testid="planner-wizard-transition">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-toba text-cream shadow-lg shadow-toba/20"><Loader2 className="h-6 w-6 animate-spin" /></span>
        <p className="mt-5 font-semibold text-ink">{transitionMessage || copy.preparing}</p>
        <p className="mt-1 text-sm text-inkSoft">{copy.understanding}</p>
      </div>
    );
  }

  return (
    <div>
      {preferredDestination && (
        <div className="mb-5 rounded-xl border border-moss/30 bg-moss/10 px-4 py-3" data-testid="planner-preferred-destination">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-inkSoft">{t.planner.preferredDestination}</p>
              <p className="mt-1 font-semibold text-ink">{preferredDestination.name}</p>
            </div>
            <button type="button" onClick={onRemovePreferred} className="rounded-full p-2 text-inkSoft hover:bg-white" aria-label={t.planner.removePreferred}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      )}

      {step === "story" && (
        <form onSubmit={onStorySubmit} data-testid="planner-wizard-story" aria-labelledby="planner-story-title">
          <StepHeading id="planner-story-title" icon={Sparkles} title={copy.storyTitle} description={copy.storyDescription} />
          <textarea
            rows={6}
            maxLength={200}
            value={form.extra_context}
            onChange={(event) => onStoryChange(event.target.value.slice(0, 200))}
            placeholder={copy.storyPlaceholder}
            className="input-flat mt-4 min-h-[140px] resize-none bg-cream/60 px-3.5 py-3 text-sm leading-6 sm:mt-5 sm:min-h-[150px] sm:px-4"
            data-testid="planner-story-input"
            aria-labelledby="planner-story-title"
            autoFocus
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {copy.examples.map((example) => <button key={example} type="button" onClick={() => onStoryChange(example)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-inkSoft transition hover:border-toba hover:text-toba">{example}</button>)}
          </div>
          <div className="mt-5 flex justify-end border-t border-line/70 pt-4 sm:mt-6">
            <button type="submit" className="btn-primary w-full rounded-2xl shadow-lg shadow-brick/20 sm:w-auto" data-testid="planner-story-submit"><Sparkles className="h-4 w-4" />{copy.planWithStory}</button>
          </div>
        </form>
      )}

      {step === "basics" && (
        <form onSubmit={onBasicsSubmit} data-testid="planner-wizard-basics" aria-labelledby="planner-basics-title">
          <StepHeading id="planner-basics-title" icon={Calendar} title={copy.basicsTitle} description={copy.basicsDescription} focusRef={stepHeadingRef} />
          <fieldset className="mt-6">
            <legend className="text-[12px] font-semibold text-inkSoft">{copy.duration}</legend>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {QUICK_DAYS.map((days) => <button key={days} type="button" onClick={() => onDaysChange(days)} className={`min-h-11 rounded-xl border text-sm font-semibold transition ${form.days === days ? "border-toba bg-toba text-cream" : "border-line bg-surface text-ink hover:border-toba/60"}`}>{days}</button>)}
            </div>
            <label className="mt-3 block text-[12px] font-semibold text-inkSoft">{lang === "en" ? "Or enter days (1–14)" : "Atau masukkan jumlah hari (1–14)"}<input required type="number" min="1" max="14" value={form.days ?? ""} onChange={(event) => onDaysChange(event.target.value)} className="input-flat mt-1.5 bg-surface" data-testid="planner-days" /></label>
          </fieldset>
          <fieldset className="mt-6" data-testid="planner-budget">
            <legend className="flex items-center gap-1.5 text-[12px] font-semibold text-inkSoft"><Wallet className="h-3.5 w-3.5" /> {copy.travelStyle}</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {options.map((option) => {
                const selected = form.budget_style === option.value;
                return <button key={option.value} type="button" onClick={() => onStyleChange(option.value)} aria-pressed={selected} className={`min-h-[64px] rounded-xl border px-2 py-2 text-center transition sm:px-3 ${selected ? "border-toba bg-toba text-cream shadow-sm" : "border-line bg-surface text-ink hover:border-toba/60"}`}><span className="block text-[11px] font-semibold leading-tight sm:text-xs">{option.label}</span><span className={`mt-1 hidden text-[10px] leading-tight sm:block ${selected ? "text-cream/75" : "text-inkSoft"}`}>{option.description}</span></button>;
              })}
            </div>
          </fieldset>
          <WizardActions backLabel={copy.backToStory} onBack={onBack} submitLabel={copy.continue} disabled={!validDays || !validStyle} />
        </form>
      )}

      {step === "interests" && (
        <form onSubmit={onInterestsSubmit} data-testid="planner-wizard-interests" aria-labelledby="planner-interests-title">
          <StepHeading id="planner-interests-title" icon={Compass} title={copy.interestsTitle} description={copy.interestsDescription} focusRef={stepHeadingRef} />
          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-labelledby="planner-interests-title">
            {CATEGORY_KEYS.map((category) => {
              const selected = form.interests.includes(category);
              return <button key={category} type="button" onClick={() => onInterestToggle(category)} aria-pressed={selected} data-testid={`planner-interest-${category}`} className={`min-h-[48px] justify-start rounded-2xl px-3 text-left text-[12px] sm:min-h-[44px] sm:justify-center sm:rounded-full sm:px-4 sm:text-[13px] ${selected ? "bg-toba font-semibold text-cream shadow-sm" : "border border-line bg-surface text-ink hover:border-toba"}`}>{t.categories[category]}</button>;
            })}
          </div>
          <WizardActions backLabel={copy.back} onBack={onBack} submitLabel={copy.create} disabled={form.interests.length === 0} />
        </form>
      )}
    </div>
  );
}

function StepHeading({ id, icon: Icon, title, description, focusRef }) {
  return <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(15,61,62,0.11),rgba(139,157,131,0.20))] px-3.5 py-3.5 sm:px-5 sm:py-4"><div className="flex items-start gap-2.5 sm:gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-toba text-cream shadow-lg shadow-toba/20 sm:h-11 sm:w-11 sm:rounded-2xl" aria-hidden="true"><Icon className="h-5 w-5" /></span><div className="min-w-0"><h2 id={id} ref={focusRef} tabIndex={focusRef ? -1 : undefined} className="text-base font-bold leading-snug text-ink outline-none sm:text-lg">{title}</h2><p className="mt-1 text-xs leading-5 text-inkSoft">{description}</p></div></div></div>;
}

function WizardActions({ backLabel, onBack, submitLabel, disabled }) {
  return <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onBack} className="inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-sm font-semibold text-inkSoft transition hover:text-toba"><ArrowLeft className="h-4 w-4" />{backLabel}</button><button type="submit" disabled={disabled} className="btn-primary w-full rounded-2xl shadow-lg shadow-brick/20 sm:w-auto"><Sparkles className="h-4 w-4" />{submitLabel}</button></div>;
}
