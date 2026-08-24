import React from "react";
import { RotateCcw } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";
import SearchInput from "./SearchInput.jsx";

export default function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  debounceMs,
  resultCount,
  hasActiveFilters = false,
  onReset,
  children,
  actions,
}) {
  const { t } = useLang();
  const copy = t.admin.dataTable;

  return (
    <div className="card-flat p-3 sm:p-4 space-y-3" data-testid="data-table-toolbar">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          debounceMs={debounceMs}
          className="w-full lg:max-w-md"
        />
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {children}
          {hasActiveFilters && onReset && (
            <button type="button" onClick={onReset} className="btn-ghost px-3 text-[12px]">
              <RotateCcw className="w-3.5 h-3.5" /> {copy.resetFilters}
            </button>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 lg:ml-auto">{actions}</div>}
      </div>
      {typeof resultCount === "number" && (
        <div className="text-[11px] text-inkSoft" aria-live="polite">
          {new Intl.NumberFormat().format(resultCount)} {copy.results}
        </div>
      )}
    </div>
  );
}
