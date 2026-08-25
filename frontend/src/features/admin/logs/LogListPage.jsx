import React, { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Eye, FileClock, RefreshCw, ScrollText } from "lucide-react";
import { AdminDrawer, AdminPagination, DataTable, DataTableToolbar, FilterPopover, StatusBadge } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import useAdminListParams from "../../../hooks/useAdminListParams.js";
import { listLogs } from "./logApi.js";
import { travelStyleLabel } from "../../../lib/travelStyle.js";

const CONFIG = {
  audit: { title: "auditTitle", sub: "auditSub", icon: FileClock, filters: ["action", "entity_type"] },
  ai: { title: "aiTitle", sub: "aiSub", icon: Bot, filters: ["status", "lang"] },
  system: { title: "systemTitle", sub: "systemSub", icon: ScrollText, filters: ["level", "source"] },
};
const valueOptions = {
  action: ["create", "update", "delete", "activate", "test", "duplicate", "approve", "reject"],
  entity_type: ["destination", "partner", "user", "premium_plan", "email_template", "llm_profile", "backup", "system_settings"],
  status: ["processing", "completed", "error"], lang: ["id", "en"],
  level: ["info", "warning", "error"], source: ["application", "settings", "backup", "ai_planner"],
};

export default function LogListPage({ type }) {
  const { lang, t } = useLang(); const copy = t.admin.logs; const config = CONFIG[type]; const Icon = config.icon; const [detail, setDetail] = useState(null);
  const { params, apiParams, setParams, resetParams } = useAdminListParams({ defaultSort: "-created_at", allowedSorts: ["-created_at"], filterKeys: [...config.filters, "date_from", "date_to"] });
  const query = useQuery({ queryKey: ["admin", "logs", type, apiParams], queryFn: ({ signal }) => listLogs(type, apiParams, signal) });
  const locale = lang === "id" ? "id-ID" : "en-US"; const items = query.data?.items || []; const total = query.data?.total || 0;
  const formatDate = useCallback((value) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-", [locale]);
  const statusBadge = (value) => <StatusBadge variant={["completed", "info"].includes(value) ? "success" : ["error", "failed"].includes(value) ? "danger" : "info"}>{value || "-"}</StatusBadge>;
  const columns = useMemo(() => {
    if (type === "audit") return [
      { key: "created_at", header: copy.time, render: (i) => formatDate(i.created_at) }, { key: "admin", header: copy.admin, render: (i) => i.admin_email || "-" }, { key: "action", header: copy.action, render: (i) => statusBadge(i.action) }, { key: "entity", header: copy.entity, render: (i) => <div><div>{i.entity_type}</div><code className="text-[10px] text-inkSoft">{i.entity_id}</code></div> }, { key: "view", header: "", mobile: false, render: (i) => <button type="button" aria-label={copy.viewDetails} className="w-9 h-9 rounded-lg hover:bg-line/30 inline-flex items-center justify-center" onClick={() => setDetail(i)}><Eye className="w-4 h-4" /></button> },
    ];
    if (type === "ai") return [
      { key: "created_at", header: copy.time, render: (i) => formatDate(i.created_at) }, { key: "status", header: copy.status, render: (i) => statusBadge(i.status) }, { key: "request", header: copy.request, render: (i) => <div>{i.days} {copy.days} · {travelStyleLabel(i.budget_style, lang, lang === "en" ? "Legacy travel preference" : "Preferensi perjalanan lama")}<div className="text-[10px] text-inkSoft">{i.lang?.toUpperCase()} · {i.catalog_size} {copy.catalogShort}</div></div> }, { key: "model", header: copy.model, render: (i) => <div><code className="text-xs">{i.llm_model || "-"}</code><div className="text-[10px] text-inkSoft">{i.llm_profile_name || i.llm_source || "environment"}</div></div> }, { key: "duration", header: copy.duration, render: (i) => i.duration_ms != null ? `${i.duration_ms} ms` : "-" }, { key: "view", header: "", mobile: false, render: (i) => <button type="button" aria-label={copy.viewDetails} className="w-9 h-9 rounded-lg hover:bg-line/30 inline-flex items-center justify-center" onClick={() => setDetail(i)}><Eye className="w-4 h-4" /></button> },
    ];
    return [
      { key: "created_at", header: copy.time, render: (i) => formatDate(i.created_at) }, { key: "level", header: copy.level, render: (i) => statusBadge(i.level) }, { key: "source", header: copy.source, render: (i) => <code className="text-xs">{i.source}</code> }, { key: "message", header: copy.message, render: (i) => <div className="max-w-xl truncate">{i.message}</div> }, { key: "view", header: "", mobile: false, render: (i) => <button type="button" aria-label={copy.viewDetails} className="w-9 h-9 rounded-lg hover:bg-line/30 inline-flex items-center justify-center" onClick={() => setDetail(i)}><Eye className="w-4 h-4" /></button> },
    ];
  }, [copy, formatDate, lang, type]);
  const activeFilterCount = [...config.filters, "date_from", "date_to"].filter((key) => params[key]).length; const filtered = Boolean(params.q || activeFilterCount);
  return <div className="w-full px-4 sm:px-6 xl:px-8 py-6 pb-16" data-testid={`${type}-log-list-page`}><header className="mb-5 flex items-end justify-between gap-3 flex-wrap"><div><div className="eyebrow">Admin · Logs</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl flex items-center gap-3"><Icon className="w-7 h-7 text-toba" />{copy[config.title]}</h1><p className="text-[13px] text-inkSoft mt-2">{copy[config.sub]}</p></div><button type="button" className="btn-outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`w-4 h-4 ${query.isFetching ? "animate-spin" : ""}`} />{copy.refresh}</button></header>
    <DataTableToolbar searchValue={params.q} onSearchChange={(q) => setParams({ q: q.length >= 2 ? q : "" })} searchPlaceholder={copy.search} resultCount={query.isSuccess ? total : undefined} hasActiveFilters={filtered} onReset={resetParams}><FilterPopover label={copy.filters} activeCount={activeFilterCount} onReset={() => setParams(Object.fromEntries([...config.filters, "date_from", "date_to"].map((key) => [key, ""]))) }>{config.filters.map((key) => <label key={key} className="block text-xs font-semibold text-inkSoft capitalize">{key === "entity_type" ? copy.entity : copy[key] || key}<select className="input-flat mt-1.5" value={params[key] || ""} onChange={(e) => setParams({ [key]: e.target.value })}><option value="">{copy.all}</option>{valueOptions[key].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}<div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-inkSoft">{copy.dateFrom}<input className="input-flat mt-1.5" type="date" value={params.date_from || ""} onChange={(e) => setParams({ date_from: e.target.value })} /></label><label className="text-xs font-semibold text-inkSoft">{copy.dateTo}<input className="input-flat mt-1.5" type="date" min={params.date_from || undefined} value={params.date_to || ""} onChange={(e) => setParams({ date_to: e.target.value })} /></label></div></FilterPopover></DataTableToolbar>
    {query.isError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{copy.loadError}</div>}
    <div className="mt-4"><DataTable columns={columns} items={items} loading={query.isLoading} hasActiveFilters={filtered} emptyTitle={copy.empty} emptyDescription={copy[config.sub]} caption={copy[config.title]} onRowClick={setDetail} footer={<AdminPagination page={params.page} pageSize={params.page_size} total={total} onPageChange={(page) => setParams({ page }, { resetPage: false })} onPageSizeChange={(page_size) => setParams({ page_size })} />} /></div>
    <AdminDrawer open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={copy.details} description={detail ? `${copy.time}: ${formatDate(detail.created_at)}` : ""}><div className="space-y-4">{detail && Object.entries(detail).map(([key, value]) => <div key={key} className="border-b border-line pb-3"><div className="text-[10px] uppercase tracking-wider text-inkSoft">{key.replaceAll("_", " ")}</div>{typeof value === "object" ? <pre className="mt-2 rounded-lg bg-ink text-cream p-3 text-[11px] overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre> : <div className="text-xs mt-1 break-words">{String(value ?? "-")}</div>}</div>)}</div></AdminDrawer>
  </div>;
}
