import React, { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { CATEGORY_KEYS } from "@/lib/i18n";
import { Sparkles, Compass, Wallet, Calendar, RefreshCw } from "lucide-react";
import UlosPattern from "@/components/UlosPattern";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Very small markdown renderer for AI output: headings, bold, lists.
function renderMarkdown(md) {
  const lines = md.split("\n");
  const out = [];
  let listBuf = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc pl-6 my-3 space-y-1 text-ink/85">
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
        <h3 key={idx} className="font-display text-2xl sm:text-3xl mt-8 mb-3 text-sunset">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("### ")) {
      flushList();
      out.push(
        <h4 key={idx} className="font-display text-xl mt-6 mb-2">
          {line.slice(4)}
        </h4>
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
          className="text-ink/85 leading-relaxed my-2"
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
  const [form, setForm] = useState({ days: 3, budget: 1500000, interests: ["nature"] });
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

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
            if (evt.done) {
              /* stream done */
            }
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
  };

  const inputCls = "w-full rounded-2xl px-5 py-4 bg-sand shadow-neu-inset outline-none";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pb-24" data-testid="planner-page">
      <header className="relative mb-10 rounded-3xl overflow-hidden neu-raised p-8 sm:p-12">
        <div className="absolute inset-0 text-jungle/[0.06]">
          <UlosPattern />
        </div>
        <div className="relative">
          <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> {t.planner.tagline}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight max-w-3xl">
            {t.planner.title}
          </h1>
          <p className="mt-4 text-muted2 max-w-2xl">{t.planner.subtitle}</p>
        </div>
      </header>

      <form onSubmit={generate} className="neu-raised rounded-3xl p-6 sm:p-8 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="block">
            <span className="text-xs text-muted2 pl-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {t.planner.days}
            </span>
            <input
              type="number"
              min="1"
              max="14"
              required
              value={form.days}
              onChange={(e) => setForm((p) => ({ ...p, days: Number(e.target.value) }))}
              className={inputCls + " mt-2"}
              data-testid="planner-days"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted2 pl-1 flex items-center gap-1">
              <Wallet className="w-3 h-3" /> {t.planner.budget}
            </span>
            <input
              type="number"
              min="0"
              step="50000"
              required
              value={form.budget}
              onChange={(e) => setForm((p) => ({ ...p, budget: Number(e.target.value) }))}
              className={inputCls + " mt-2"}
              data-testid="planner-budget"
            />
          </label>
        </div>

        <div className="mt-6">
          <span className="text-xs text-muted2 pl-1 flex items-center gap-1 mb-3">
            <Compass className="w-3 h-3" /> {t.planner.interests}
          </span>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_KEYS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleInterest(cat)}
                data-testid={`planner-interest-${cat}`}
                className={`px-5 py-2.5 rounded-full text-sm transition-all ${
                  form.interests.includes(cat)
                    ? "shadow-neu-pressed text-sunset font-semibold"
                    : "shadow-neu-sm hover:text-sunset"
                }`}
              >
                {t.categories[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={streaming}
            className="px-7 py-4 rounded-full bg-sunset text-sand font-semibold text-sm hover:bg-sunset/90 disabled:opacity-60 flex items-center gap-2"
            data-testid="planner-generate-btn"
          >
            <Sparkles className="w-4 h-4" />
            {streaming ? t.planner.generating : t.planner.generate}
          </button>
          {(output || error) && !streaming && (
            <button
              type="button"
              onClick={reset}
              className="px-6 py-4 rounded-full shadow-neu-sm text-sm flex items-center gap-2"
              data-testid="planner-reset-btn"
            >
              <RefreshCw className="w-4 h-4" /> {t.planner.newPlan}
            </button>
          )}
        </div>
      </form>

      {error && (
        <div
          className="rounded-3xl p-6 mb-6 shadow-neu-inset text-red-600 text-sm"
          data-testid="planner-error"
        >
          {error}
        </div>
      )}

      {(output || streaming) && (
        <article className="neu-raised rounded-3xl p-6 sm:p-10" data-testid="planner-output">
          <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-2">
            {t.planner.itineraryTitle}
          </div>
          {streaming && !output && (
            <div className="text-muted2 flex items-center gap-2 py-6">
              <span className="inline-block w-2 h-2 bg-sunset rounded-full animate-pulse" />
              {t.planner.generating}
            </div>
          )}
          <div className="prose max-w-none">{renderMarkdown(output)}</div>
        </article>
      )}
    </div>
  );
}
