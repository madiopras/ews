import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";

const TYPE_DELAY_MS = 64;
const HOLD_DELAY_MS = 1800;
const DELETE_DELAY_MS = 36;
const NEXT_EXAMPLE_DELAY_MS = 280;
const EMPTY_PLACEHOLDERS = [];

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  ));

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = (event) => setReducedMotion(event.matches);
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  return reducedMotion;
}

function useTypewriterPlaceholder(examples, active) {
  const reducedMotion = useReducedMotion();
  const [animation, setAnimation] = useState(() => ({
    exampleIndex: 0,
    text: examples[0]?.slice(0, 1) || "",
    phase: "typing",
  }));

  useEffect(() => {
    setAnimation({
      exampleIndex: 0,
      text: reducedMotion ? (examples[0] || "") : (examples[0]?.slice(0, 1) || ""),
      phase: "typing",
    });
  }, [examples, reducedMotion]);

  useEffect(() => {
    if (!active || reducedMotion || examples.length === 0) return undefined;
    const target = examples[animation.exampleIndex] || examples[0];
    let delay = TYPE_DELAY_MS;

    if (animation.phase === "holding") delay = HOLD_DELAY_MS;
    if (animation.phase === "deleting") delay = DELETE_DELAY_MS;
    if (animation.phase === "gap") delay = NEXT_EXAMPLE_DELAY_MS;

    const timer = window.setTimeout(() => {
      setAnimation((current) => {
        if (current.phase === "typing") {
          if (current.text.length < target.length) {
            return { ...current, text: target.slice(0, current.text.length + 1) };
          }
          return { ...current, phase: "holding" };
        }
        if (current.phase === "holding") return { ...current, phase: "deleting" };
        if (current.phase === "deleting") {
          if (current.text.length > 0) return { ...current, text: current.text.slice(0, -1) };
          return { ...current, phase: "gap" };
        }
        const nextIndex = (current.exampleIndex + 1) % examples.length;
        return {
          exampleIndex: nextIndex,
          text: examples[nextIndex]?.slice(0, 1) || "",
          phase: "typing",
        };
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [active, animation, examples, reducedMotion]);

  return {
    text: reducedMotion ? (examples[0] || "") : animation.text,
    reducedMotion,
  };
}

export default function TripPromptComposer({
  value,
  onChange,
  placeholder,
  animatedPlaceholders = EMPTY_PLACEHOLDERS,
  submitLabel,
  lang = "id",
  maxLength = 200,
  testIdPrefix = "trip-prompt",
  className = "",
  autoFocus = false,
}) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [focused, setFocused] = useState(false);
  const examples = useMemo(
    () => animatedPlaceholders.filter((example) => typeof example === "string" && example.trim()),
    [animatedPlaceholders],
  );
  const animated = useTypewriterPlaceholder(examples, !value && !focused);
  const hasAnimatedPlaceholder = examples.length > 0;
  const SpeechRecognition = typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleVoiceInput = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang === "en" ? "en-US" : "id-ID";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      const separator = value.trim() ? " " : "";
      onChange(`${value.trimEnd()}${separator}${transcript}`.slice(0, maxLength));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const voiceLabel = listening
    ? (lang === "en" ? "Stop voice input" : "Hentikan input suara")
    : (lang === "en" ? "Use voice input" : "Gunakan input suara");

  return (
    <div className={`flex min-h-[132px] flex-col rounded-[26px] border border-white/80 bg-surface p-3 shadow-[0_16px_36px_rgba(15,61,62,0.16)] sm:min-h-[178px] sm:p-4 ${className}`} data-testid={`${testIdPrefix}-composer`}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <textarea
          rows={3}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={hasAnimatedPlaceholder ? "" : placeholder}
          className="h-full min-h-0 w-full resize-none bg-transparent px-1 py-1 text-base leading-6 text-ink outline-none placeholder:text-inkSoft/70 sm:px-2 sm:py-2"
          data-testid={`${testIdPrefix}-input`}
          aria-label={placeholder}
          autoFocus={autoFocus}
        />
        {hasAnimatedPlaceholder && !value && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap px-1 py-1 text-base leading-6 text-inkSoft/70 sm:px-2 sm:py-2" aria-hidden="true" data-testid={`${testIdPrefix}-animated-placeholder`}>
            {animated.text}
            {!animated.reducedMotion && !focused && <span className="ml-0.5 inline-block h-[1em] w-px translate-y-[0.12em] animate-pulse bg-toba/55" />}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleVoiceInput}
          disabled={!SpeechRecognition}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${listening ? "bg-brick text-cream" : "text-toba hover:bg-toba/10 disabled:cursor-not-allowed disabled:opacity-35"}`}
          aria-label={voiceLabel}
          title={SpeechRecognition ? voiceLabel : (lang === "en" ? "Voice input is not supported by this browser" : "Input suara tidak didukung browser ini")}
          data-testid={`${testIdPrefix}-voice`}
        >
          {listening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
        </button>
        <button
          type="submit"
          disabled={!value.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brick px-5 text-xs font-bold text-cream shadow-[0_8px_18px_rgba(185,65,39,0.24)] transition-colors duration-200 hover:bg-[#A93A21] disabled:cursor-not-allowed disabled:opacity-45 sm:px-6 sm:text-sm"
          data-testid={`${testIdPrefix}-submit`}
        >
          {submitLabel}<Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
