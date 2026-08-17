import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import DestinationCard from "@/components/DestinationCard";
import { Heart, Sparkles, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

function renderMd(md) {
  const lines = md.split("\n");
  const out = [];
  let listBuf = [];
  const flush = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc pl-6 my-2 space-y-1 text-ink/85 text-sm">
          {listBuf.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ul>
      );
      listBuf = [];
    }
  };
  const bold = (s) =>
    s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      out.push(<h4 key={i} className="font-display text-xl mt-4 mb-2 text-sunset">{line.slice(3)}</h4>);
    } else if (line.startsWith("### ")) {
      flush();
      out.push(<h5 key={i} className="font-display text-base mt-3 mb-1">{line.slice(4)}</h5>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(bold(line.slice(2)));
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(<p key={i} className="text-sm text-ink/85 leading-relaxed my-1.5" dangerouslySetInnerHTML={{ __html: bold(line) }} />);
    }
  });
  flush();
  return out;
}

export default function Wishlist() {
  const { t, lang } = useLang();
  const [tab, setTab] = useState("destinations");
  const [dests, setDests] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/wishlist").then((r) => r.data).catch(() => []),
      api.get("/itineraries").then((r) => r.data).catch(() => []),
    ]).then(([d, i]) => {
      setDests(d);
      setTrips(i);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const deleteTrip = async (id) => {
    if (!window.confirm(t.savedTrips.confirmDelete)) return;
    try {
      await api.delete(`/itineraries/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pb-24" data-testid="wishlist-page">
      <header className="mb-8 flex items-start gap-4">
        <span className="w-14 h-14 rounded-full shadow-neu-raised flex items-center justify-center text-sunset">
          <Heart className="w-6 h-6 fill-current" />
        </span>
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-sunset mb-1">
            {t.nav.wishlist}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl leading-tight">
            {t.wishlist.title}
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setTab("destinations")}
          className={`px-6 py-3 rounded-full text-sm transition-all ${
            tab === "destinations" ? "shadow-neu-pressed text-sunset font-semibold" : "shadow-neu-sm hover:text-sunset"
          }`}
          data-testid="wishlist-tab-dest"
        >
          <Heart className="w-4 h-4 inline mr-2" />
          {t.savedTrips.destTab} ({dests.length})
        </button>
        <button
          onClick={() => setTab("trips")}
          className={`px-6 py-3 rounded-full text-sm transition-all ${
            tab === "trips" ? "shadow-neu-pressed text-sunset font-semibold" : "shadow-neu-sm hover:text-sunset"
          }`}
          data-testid="wishlist-tab-trips"
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          {t.savedTrips.tab} ({trips.length})
        </button>
      </div>

      {loading ? (
        <div className="text-muted2">{t.common.loading}</div>
      ) : tab === "destinations" ? (
        dests.length === 0 ? (
          <div className="text-center py-20 neu-raised rounded-3xl">
            <div className="font-display text-2xl mb-4">{t.wishlist.empty}</div>
            <Link
              to="/explore"
              className="inline-block px-6 py-3 rounded-full bg-sunset text-sand font-semibold text-sm hover:bg-sunset/90"
              data-testid="wishlist-browse-btn"
            >
              {t.wishlist.browse}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {dests.map((d, i) => (
              <DestinationCard key={d.id} dest={d} index={i} />
            ))}
          </div>
        )
      ) : trips.length === 0 ? (
        <div className="text-center py-20 neu-raised rounded-3xl">
          <div className="font-display text-2xl mb-4">{t.savedTrips.empty}</div>
          <Link
            to="/planner"
            className="inline-block px-6 py-3 rounded-full bg-sunset text-sand font-semibold text-sm hover:bg-sunset/90"
            data-testid="wishlist-planner-btn"
          >
            {t.planner.title}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((tr) => (
            <div
              key={tr.id}
              className="neu-raised rounded-3xl overflow-hidden"
              data-testid={`saved-trip-${tr.id}`}
            >
              <div className="w-full p-6 flex items-center justify-between gap-4">
                <button
                  onClick={() => setExpanded(expanded === tr.id ? null : tr.id)}
                  className="flex-1 min-w-0 text-left"
                  data-testid={`saved-trip-toggle-${tr.id}`}
                >
                  <div className="font-display text-xl truncate">{tr.title}</div>
                  <div className="text-xs text-muted2 mt-1">
                    {tr.days} {lang === "en" ? "days" : "hari"} · Rp {new Intl.NumberFormat("id-ID").format(tr.budget)}
                    {" · "}
                    {new Date(tr.created_at).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => deleteTrip(tr.id)}
                    className="w-10 h-10 rounded-full shadow-neu-sm flex items-center justify-center hover:text-red-500"
                    data-testid={`saved-trip-delete-${tr.id}`}
                    aria-label="delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === tr.id ? null : tr.id)}
                    className="w-10 h-10 rounded-full shadow-neu-sm flex items-center justify-center hover:text-sunset"
                    aria-label="expand"
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        expanded === tr.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>
              {expanded === tr.id && (
                <div className="px-6 pb-6 border-t border-sandDark/40 pt-4">
                  <div className="prose max-w-none">{renderMd(tr.content)}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
