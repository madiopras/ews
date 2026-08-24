import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";
import EmptyState from "./EmptyState.jsx";
import TableSkeleton from "./TableSkeleton.jsx";

function valueFor(item, column) {
  if (column.render) return column.render(item);
  if (typeof column.accessor === "function") return column.accessor(item);
  return item[column.accessor || column.key];
}

function itemKey(item, rowKey, index) {
  if (typeof rowKey === "function") return rowKey(item);
  return item[rowKey] ?? index;
}

export default function DataTable({
  columns,
  items = [],
  rowKey = "id",
  loading = false,
  skeletonRows = 5,
  sort = "",
  onSort,
  onRowClick,
  renderMobileCard,
  emptyTitle,
  emptyDescription,
  emptyAction,
  hasActiveFilters = false,
  caption,
  footer,
}) {
  const { t } = useLang();
  const copy = t.admin.dataTable;
  const activeSort = sort.replace(/^-/, "");
  const descending = sort.startsWith("-");

  const changeSort = (column) => {
    if (!column.sortable || !onSort) return;
    const sortKey = column.sortKey || column.key;
    const nextSort = activeSort === sortKey ? (descending ? sortKey : `-${sortKey}`) : sortKey;
    onSort(nextSort);
  };

  const handleRowClick = (event, item) => {
    if (!onRowClick || event.target.closest("button, a, input, select, textarea")) return;
    onRowClick(item);
  };

  return (
    <section className="card-flat overflow-hidden" data-testid="admin-data-table">
      {loading ? (
        <TableSkeleton rows={skeletonRows} columns={columns.length} />
      ) : items.length === 0 ? (
        <EmptyState
          filtered={hasActiveFilters}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse">
              {caption && <caption className="sr-only">{caption}</caption>}
              <thead className="bg-line/25 text-inkSoft border-b border-line">
                <tr>
                  {columns.map((column) => {
                    const sortKey = column.sortKey || column.key;
                    const isSorted = activeSort === sortKey;
                    const SortIcon = isSorted ? (descending ? ArrowDown : ArrowUp) : ArrowUpDown;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        className={`px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.08em] whitespace-nowrap ${column.headerClassName || ""}`}
                        aria-sort={isSorted ? (descending ? "descending" : "ascending") : undefined}
                      >
                        {column.sortable && onSort ? (
                          <button type="button" onClick={() => changeSort(column)} className="inline-flex items-center gap-1.5 hover:text-toba" aria-label={`${copy.sortBy} ${column.header}`}>
                            {column.header}
                            <SortIcon className={`w-3.5 h-3.5 ${isSorted ? "text-toba" : "opacity-40"}`} />
                          </button>
                        ) : column.header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item, index) => (
                  <tr
                    key={itemKey(item, rowKey, index)}
                    onClick={(event) => handleRowClick(event, item)}
                    onKeyDown={(event) => {
                      if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onRowClick(item);
                      }
                    }}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={onRowClick ? "hover:bg-line/15 cursor-pointer focus:outline-none focus:bg-line/20" : "hover:bg-line/10"}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={`px-4 py-3 align-middle ${column.cellClassName || ""}`}>
                        {valueFor(item, column) ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-line">
            {items.map((item, index) => renderMobileCard ? (
              <div key={itemKey(item, rowKey, index)}>{renderMobileCard(item)}</div>
            ) : (
              <article key={itemKey(item, rowKey, index)}>
                <div
                  className={`p-4 space-y-3 ${onRowClick ? "cursor-pointer active:bg-line/20" : ""}`}
                  onClick={(event) => handleRowClick(event, item)}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onRowClick(item);
                    }
                  }}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.filter((column) => column.mobile !== false).map((column) => (
                    <div key={column.key} className="flex items-start justify-between gap-4">
                      <span className="text-[11px] text-inkSoft shrink-0">{column.mobileHeader || column.header}</span>
                      <div className="text-[12px] text-right min-w-0 break-words">{valueFor(item, column) ?? "-"}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {footer}
    </section>
  );
}
