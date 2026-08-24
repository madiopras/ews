import React from "react";
import { Clock3, UserRoundCheck } from "lucide-react";
import { StatusBadge } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";

export default function PartnerApprovalHistory({ history = [] }) {
  const { t, lang } = useLang();
  const copy = t.admin.partnerAdmin;
  const variants = { approved: "success", rejected: "danger", pending: "warning", needs_revision: "warning", draft: "neutral" };
  if (history.length === 0) return <div className="card-flat p-8 text-center text-[12px] text-inkSoft">{copy.noHistory}</div>;
  return (
    <div className="card-flat divide-y divide-line" data-testid="partner-approval-history">
      {[...history].reverse().map((item, index) => (
        <article key={`${item.reviewed_at}-${index}`} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <StatusBadge variant={variants[item.status] || "neutral"}>{copy[item.status] || item.status}</StatusBadge>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[12px] font-medium"><UserRoundCheck className="w-4 h-4 text-inkSoft" /> {item.reviewer_email || item.reviewed_by || "-"}</div>
            {item.revision_note && <p className="mt-1 text-[12px] text-inkSoft">{item.revision_note}</p>}
          </div>
          <time className="inline-flex items-center gap-1.5 text-[11px] text-inkSoft"><Clock3 className="w-3.5 h-3.5" />{item.reviewed_at ? new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.reviewed_at)) : "-"}</time>
        </article>
      ))}
    </div>
  );
}
