import React, { useState } from "react";
import { Copy, Link2Off, MessageCircle, Share2 } from "lucide-react";
import { api } from "../lib/api.js";
import { useLang } from "../contexts/LanguageContext.jsx";
import { toast } from "sonner";

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const field = document.createElement("textarea");
  field.value = value;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copy failed");
}

export function canonicalTripUrl(slug, origin = window.location.origin) {
  return slug ? new URL(`/trip/${slug}`, origin).toString() : "";
}

export function socialTripUrl(slug, backendOrigin = process.env.REACT_APP_BACKEND_URL || window.location.origin) {
  return slug ? new URL(`/api/share/${slug}`, backendOrigin).toString() : "";
}

export default function TripShareControls({ trip, onChange }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const canonicalUrl = canonicalTripUrl(trip.share_slug);
  const socialUrl = socialTripUrl(trip.share_slug);
  const setPublic = async (isPublic) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/itineraries/${trip.id}/share`, { public: isPublic });
      onChange(data);
      toast.success(isPublic ? t.savedTrips.shareOn : t.savedTrips.sharingStopped);
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy(false);
    }
  };
  if (!trip.is_public) return <button type="button" onClick={() => setPublic(true)} disabled={busy} className="btn-outline"><Share2 className="h-4 w-4" /> {t.savedTrips.shareOff}</button>;
  return (
    <div className="rounded-xl border border-line bg-cream/60 p-4" data-testid="trip-share-controls">
      <div className="break-all text-[12px] text-toba">{canonicalUrl}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${t.savedTrips.waText} ${trip.title} — ${socialUrl}`)}`} target="_blank" rel="noopener noreferrer" className="btn-primary"><MessageCircle className="h-4 w-4" /> {t.savedTrips.shareWA}</a>
        <button type="button" onClick={async () => { try { await copyText(canonicalUrl); toast.success(t.savedTrips.copied); } catch { toast.error(t.common.error); } }} className="btn-outline"><Copy className="h-4 w-4" /> {t.savedTrips.copyLink}</button>
        <button type="button" onClick={() => setPublic(false)} disabled={busy} className="btn-outline"><Link2Off className="h-4 w-4" /> {t.savedTrips.stopSharing}</button>
      </div>
    </div>
  );
}
