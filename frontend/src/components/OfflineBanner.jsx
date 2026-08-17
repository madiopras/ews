import React from "react";
import { WifiOff } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

export default function OfflineBanner({ savedAt }) {
  const { t, lang } = useLang();
  if (!savedAt) return null;
  const stamp = new Date(savedAt).toLocaleString(lang === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-3 mb-4 rounded-lg border border-line bg-moss/15 text-[13px] text-ink"
      data-testid="offline-banner"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-[#4F6047]" />
      <span>
        {t.offline.banner} <strong>{stamp}</strong>
      </span>
    </div>
  );
}
