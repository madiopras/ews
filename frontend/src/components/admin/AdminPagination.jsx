import React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";
import { ADMIN_PAGE_SIZES } from "../../lib/adminQueryParams.js";

function visiblePages(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const values = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...values].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result = [];
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) result.push(`gap-${value}`);
    result.push(value);
  });
  return result;
}

export default function AdminPagination({ page = 1, pageSize = 25, total = 0, onPageChange, onPageSizeChange, pageSizes = ADMIN_PAGE_SIZES }) {
  const { t } = useLang();
  const copy = t.admin.dataTable;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-line bg-surface" data-testid="admin-pagination">
      <div className="text-[11px] text-inkSoft" aria-live="polite">
        {copy.showing} {start}–{end} {copy.of} {new Intl.NumberFormat().format(total)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-[11px] text-inkSoft">
            <span className="hidden sm:inline">{copy.rowsPerPage}</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="min-h-[40px] rounded-lg border border-line bg-surface px-2 text-[12px] text-ink"
              aria-label={copy.rowsPerPage}
            >
              {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        )}
        <nav className="flex items-center gap-1" aria-label={copy.pagination}>
          <button type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} className="w-10 h-10 rounded-lg border border-line flex items-center justify-center disabled:opacity-40" aria-label={copy.previousPage}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="hidden md:flex items-center gap-1">
            {visiblePages(safePage, pageCount).map((value) => typeof value === "string" ? (
              <span key={value} className="w-8 h-10 flex items-center justify-center text-inkSoft" aria-hidden="true"><MoreHorizontal className="w-4 h-4" /></span>
            ) : (
              <button
                key={value}
                type="button"
                onClick={() => onPageChange(value)}
                className={`min-w-10 h-10 px-2 rounded-lg border text-[12px] ${safePage === value ? "bg-toba text-cream border-toba font-semibold" : "bg-surface border-line hover:border-toba"}`}
                aria-label={`${copy.page} ${value}`}
                aria-current={safePage === value ? "page" : undefined}
              >
                {value}
              </button>
            ))}
          </div>
          <span className="md:hidden text-[12px] text-inkSoft px-2">{safePage} / {pageCount}</span>
          <button type="button" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)} className="w-10 h-10 rounded-lg border border-line flex items-center justify-center disabled:opacity-40" aria-label={copy.nextPage}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
