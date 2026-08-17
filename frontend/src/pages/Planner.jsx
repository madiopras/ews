import React, { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { CATEGORY_KEYS } from "@/lib/i18n";
import { Sparkles, Compass, Wallet, Calendar, RefreshCw, Save } from "lucide-react";
import UlosPattern from "@/components/UlosPattern";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Very small markdown renderer for AI output: headings, bold, lists, blockquotes.
function renderMarkdown(md) {
  const lines = md.split("\n");
  const out = [];
  let listBuf = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc pl-5 my-3 space-y-1 text-[14px] text-inkSoft">
          {listBuf.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ul>
      );
      listBuf = [];
    }
  };
  const bold = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong class='text-ink'>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushList();
      out.push(
        <h3 key={idx} className="font-display text-[22px] sm:text-2xl mt-7 mb-2 text-toba">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("### ")) {
      flushList();
      out.push(
        <h4 key={idx} className="font-display text-[18px] mt-5 mb-1.5">
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith("> ")) {
      flushList();
      out.push(
        <blockquote
          key={idx}
          className="my-3 pl-3.5 border-l-2 border-moss bg-moss/10 rounded-r-lg py-2.5 pr-3 text-[13px] text-ink"
          dangerouslySetInnerHTML={{ __html: bold(line.slice(2)) }}
        />
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(bold(line.slice(2)));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p
          key={idx}
          className="text-[14px] text-inkSoft leading-relaxed my-2"
          dangerouslySetInnerHTML={{ __html: bold(line) }}
        />
      );
    }
  });
  flushList();
  return out;
}

export default function Planner() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ days: 3, budget: 1500000, interests: ["nature"], extra_context: "" });
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (cat) => {
    setForm((p) => ({
      ...p,
      interests: p.interests.includes(cat)
        ? p.interests.filter((c) => c !== cat)
        : [...p.interests, cat],
    }));
  };

  const generate = async (e) => {
    e.preventDefault();
    setOutput("");
    setError("");
    setStreaming(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/trip-planner/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, lang }),
      });
      if (!res.ok || !res.body) {
        setError("Failed to start planner");
        setStreaming(false);
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
            if (evt.text) setOutput((prev) => prev + evt.text);
            if (evt.error) setError(evt.error);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setStreaming(false);
    }
  };

  const reset = () => {
    setOutput("");
    setError("");
    setSavedId(null);
    setShowSave(false);
    setSaveTitle("");
  };

  const saveTrip = async () => {
    if (!user || typeof user !== "object") {
      toast.error(t.detail.loginToSave);
      navigate("/login");
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
      });
      setSavedId(data.id);
      setShowSave(false);
      toast.success(t.savedTrips.saved);
    } catch (err) {
      toast.error("Error saving trip");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="planner-page">
      {/* HERO — dark teal */}
      <header className="relative bg-toba overflow-hidden">
        <div className="absolute inset-0 text-cream/[0.07]">
          <UlosPattern />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
          <div className="text-[12px] tracking-[0.18em] uppercase text-cream/70 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> {t.planner.tagline}
          </div>
          <h1 className="mt-3 font-display text-[26px] sm:text-4xl lg:text-5xl leading-tight text-cream">
            {t.planner.title}
          </h1>
          <p className="mt-3 text-[14px] sm:text-base text-cream/80 max-w-2xl leading-relaxed">
            {t.planner.subtitle}
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-24 md:pb-16">
        <form onSubmit={generate} className="card-flat p-4 sm:p-6">
          {/* single column on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[13px] text-inkSoft flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {t.planner.days}
              </span>
              <input
                type="number"
                min="1"
                max="14"
                required
                value={form.days}
                onChange={(e) => setForm((p) => ({ ...p, days: Number(e.target.value) }))}
                className="input-flat mt-2"
                data-testid="planner-days"
              />
            </label>
            <label className="block">
              <span className="text-[13px] text-inkSoft flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> {t.planner.budget}
              </span>
              <input
                type="number"
                min="0"
                step="50000"
                required
                value={form.budget}
                onChange={(e) => setForm((p) => ({ ...p, budget: Number(e.target.value) }))}
                className="input-flat mt-2"
                data-testid="planner-budget"
              />
            </label>
          </div>

          <div className="mt-5">
            <span className="text-[13px] text-inkSoft flex items-center gap-1.5 mb-2.5">
              <Compass className="w-3.5 h-3.5" /> {t.planner.interests}
            </span>
            <div className="scroll-x">
              {CATEGORY_KEYS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleInterest(cat)}
                  data-testid={`planner-interest-${cat}`}
                  className={`chip ${form.interests.includes(cat) ? "chip-active" : ""}`}
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
              className="input-flat resize-none"
              data-testid="planner-extra-context"
            />
          </div>

          {/* Desktop actions */}
          <div className="mt-6 hidden md:flex gap-3">
            <button type="submit" disabled={streaming} className="btn-primary" data-testid="planner-generate-btn">
              <Sparkles className="w-4 h-4" />
              {streaming ? t.planner.generating : t.planner.generate}
            </button>
            {(output || error) && !streaming && (
              <button type="button" onClick={reset} className="btn-outline" data-testid="planner-reset-btn">
                <RefreshCw className="w-4 h-4" /> {t.planner.newPlan}
              </button>
            )}
          </div>

          {/* Mobile: thumb-reachable sticky action bar */}
          <div className="md:hidden fixed left-0 right-0 bottom-[56px] z-40 px-4 py-3 bg-cream/95 backdrop-blur border-t border-line flex gap-2">
            <button
              type="submit"
              disabled={streaming}
              className="btn-primary flex-1"
              data-testid="planner-generate-btn-mobile"
            >
              <Sparkles className="w-4 h-4" />
              {streaming ? t.planner.generating : t.planner.generate}
            </button>
            {(output || error) && !streaming && (
              <button
                type="button"
                onClick={reset}
                className="btn-outline px-4"
                data-testid="planner-reset-btn-mobile"
                aria-label={t.planner.newPlan}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {error && (
          <div
            className="card-flat border-red-300 bg-red-50 p-4 mt-5 text-red-700 text-[13px]"
            data-testid="planner-error"
          >
            {error}
          </div>
        )}

        {(output || streaming) && (
          <article className="card-flat p-4 sm:p-7 mt-5" data-testid="planner-output">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="eyebrow">{t.planner.itineraryTitle}</div>
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
                      onClick={() => setShowSave(true)}
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
            {streaming && !output && (
              <div className="text-inkSoft text-[13px] flex items-center gap-2 py-5">
                <span className="inline-block w-2 h-2 bg-toba rounded-full animate-pulse" />
                {t.planner.generating}
              </div>
            )}
            <div className="max-w-none">{renderMarkdown(output)}</div>
          </article>
        )}
      </div>
    </div>
  );
}
