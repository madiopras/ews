import React from "react";
import { Inbox, SearchX } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";

export default function EmptyState({ filtered = false, title, description, action, icon: CustomIcon }) {
  const { t } = useLang();
  const copy = t.admin.dataTable;
  const Icon = CustomIcon || (filtered ? SearchX : Inbox);

  return (
    <div className="py-12 px-5 text-center" data-testid="data-table-empty">
      <span className="mx-auto w-12 h-12 rounded-xl bg-line/40 text-inkSoft flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </span>
      <h3 className="font-semibold text-sm mt-4">{title || (filtered ? copy.noResults : copy.noData)}</h3>
      <p className="text-[12px] text-inkSoft mt-1 max-w-md mx-auto">
        {description || (filtered ? copy.noResultsDescription : copy.noDataDescription)}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
