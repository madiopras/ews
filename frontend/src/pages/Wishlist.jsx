import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
        <ul key={`ul-${out.length}`} className="list-disc pl-5 my-2 space-y-1 text-[13px] text-inkSoft">
          {listBuf.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ul>
      );
      listBuf = [];
    }
  };
  const bold = (s) =>
    s.replace(/\*\*(.+?)\*\*/g, "<strong class='text-ink'>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      out.push(<h4 key={i} className="font-display text-[19px] mt-4 mb-1.5 text-toba">{line.slice(3)}</h4>);
    } else if (line.startsWith("### ")) {
      flush();
      out.push(<h5 key={i} className="font-display text-[15px] mt-3 mb-1">{line.slice(4)}</h5>);
    } else if (line.startsWith("> ")) {
      flush();
      out.push(
        <blockquote
          key={i}
          className="my-2 pl-3 border-l-2 border-moss bg-moss/10 rounded-r-lg py-2 pr-3 text-[13px] text-ink"
          dangerouslySetInnerHTML={{ __html: bold(line.slice(2)) }}
        />
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(bold(line.slice(2)));
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(
        <p key={i} className="text-[13px] text-inkSoft leading-relaxed my-1.5" dangerouslySetInnerHTML={{ __html: bold(line) }} />
      );
    }
  });
  flush();
  return out;
}

export default function Wishlist() {
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "trips" ? "trips" : "destinations");
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-16" data-testid="wishlist-page">
      <header className="mb-5">
        <div className="eyebrow flex items-center gap-2">
          <Heart className="w-4 h-4" /> {t.nav.wishlist}
        </div>
        <h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">
          {t.wishlist.title}
        </h1>
      </header>

      <div className="scroll-x mb-6">
        <button
          onClick={() => setTab("destinations")}
          className={`chip ${tab === "destinations" ? "chip-active" : ""}`}
          data-testid="wishlist-tab-dest"
        >
          <Heart className="w-4 h-4 mr-2" />
          {t.savedTrips.destTab} ({dests.length})
        </button>
        <button
          onClick={() => setTab("trips")}
          className={`chip ${tab === "trips" ? "chip-active" : ""}`}
          data-testid="wishlist-tab-trips"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {t.savedTrips.tab} ({trips.length})
        </button>
      </div>

      {loading ? (
        <div className="text-inkSoft text-[13px]">{t.common.loading}</div>
      ) : tab === "destinations" ? (
        dests.length === 0 ? (
          <div className="card-flat text-center py-14 px-4">
            <div className="font-display text-[22px] mb-4">{t.wishlist.empty}</div>
            <Link to="/explore" className="btn-primary" data-testid="wishlist-browse-btn">
              {t.wishlist.browse}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {dests.map((d, i) => (
              <DestinationCard key={d.id} dest={d} index={i} />
            ))}
          </div>
        )
      ) : trips.length === 0 ? (
        <div className="card-flat text-center py-14 px-4">
          <div className="font-display text-[22px] mb-4">{t.savedTrips.empty}</div>
          <Link to="/planner" className="btn-primary" data-testid="wishlist-planner-btn">
            {t.planner.title}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((tr) => (
            <div key={tr.id} className="card-flat overflow-hidden" data-testid={`saved-trip-${tr.id}`}>
              <div className="w-full p-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => setExpanded(expanded === tr.id ? null : tr.id)}
                  className="flex-1 min-w-0 text-left min-h-[44px]"
                  data-testid={`saved-trip-toggle-${tr.id}`}
                >
                  <div className="font-display text-[19px] truncate">{tr.title}</div>
                  <div className="text-[12px] text-inkSoft mt-1">
                    {tr.days} {lang === "en" ? "days" : "hari"} · Rp{" "}
                    {new Intl.NumberFormat("id-ID").format(tr.budget)}
                    {" · "}
                    {new Date(tr.created_at).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => deleteTrip(tr.id)}
                    className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-red-500 transition-colors"
                    data-testid={`saved-trip-delete-${tr.id}`}
                    aria-label="delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === tr.id ? null : tr.id)}
                    className="w-11 h-11 rounded-lg border border-line flex items-center justify-center text-inkSoft hover:text-toba transition-colors"
                    aria-label="expand"
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${expanded === tr.id ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>
              {expanded === tr.id && (
                <div className="px-4 pb-4 border-t border-line pt-3">{renderMd(tr.content)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
