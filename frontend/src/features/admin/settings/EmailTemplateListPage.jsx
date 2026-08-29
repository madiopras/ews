import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AdminPagination, ConfirmActionDialog, DataTable, DataTableToolbar, FilterPopover, StatusBadge } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import useAdminListParams from "../../../hooks/useAdminListParams.js";
import { formatError } from "../../../lib/api.js";
import { deleteEmailTemplate, listEmailTemplates } from "./settingsApi.js";

const OPTIONS = { defaultSort: "key", allowedSorts: ["key", "-key", "name", "-name", "updated_at", "-updated_at"], filterKeys: ["status"] };
export default function EmailTemplateListPage() {
  const { lang, t } = useLang(); const copy = t.admin.settings; const qc = useQueryClient(); const { params, apiParams, setParams, resetParams } = useAdminListParams(OPTIONS); const [target, setTarget] = useState(null);
  const query = useQuery({ queryKey: ["admin", "email-templates", apiParams], queryFn: ({ signal }) => listEmailTemplates(apiParams, signal) });
  const mutation = useMutation({ mutationFn: () => deleteEmailTemplate(target.id), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["admin", "email-templates"] }); toast.success(copy.templateDeleted); setTarget(null); }, onError: (e) => toast.error(formatError(e.response?.data?.detail || copy.actionError)) });
  const items = query.data?.items || []; const total = query.data?.total || 0; const filtered = Boolean(params.q || params.status);
  const columns = useMemo(() => [
    { key: "key", header: copy.key, sortable: true, render: (item) => <div className="flex gap-3 items-center min-w-[180px]"><span className="w-9 h-9 rounded-lg bg-line/30 text-toba flex items-center justify-center"><Mail className="w-4 h-4" /></span><div><code className="text-xs">{item.key}</code><div className="font-semibold text-xs mt-1">{item.name}</div></div></div> },
    { key: "subject", header: copy.subject, render: (item) => <div className="max-w-[320px]"><div className="truncate">{item.subject_id}</div><div className="truncate text-[11px] text-inkSoft mt-1">{item.subject_en}</div></div> },
    { key: "status", header: copy.status, render: (item) => <StatusBadge variant={item.enabled ? "success" : "neutral"}>{item.enabled ? copy.enabled : copy.disabled}</StatusBadge> },
    { key: "updated_at", header: copy.updated, sortable: true, render: (item) => item.updated_at ? new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", { dateStyle: "medium" }).format(new Date(item.updated_at)) : "-" },
    { key: "actions", header: "", mobile: false, cellClassName: "text-right", render: (item) => <div className="flex justify-end gap-1"><Link className="w-9 h-9 rounded-lg hover:bg-line/30 inline-flex items-center justify-center" to={`/admin/settings/email-templates/${item.id}/edit`} aria-label={copy.edit}><Pencil className="w-4 h-4" /></Link><button type="button" className="w-9 h-9 rounded-lg hover:bg-red-50 text-red-700 inline-flex items-center justify-center" onClick={() => setTarget(item)} aria-label={copy.remove}><Trash2 className="w-4 h-4" /></button></div> },
  ], [copy, lang]);
  return <div className="app-gutter w-full py-6 pb-16" data-testid="email-template-list-page"><header className="mb-5 flex items-end justify-between flex-wrap gap-3"><div><div className="eyebrow">Admin · Settings</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl">{copy.templateTitle}</h1><p className="text-[13px] text-inkSoft mt-2">{copy.templateSub}</p></div><Link className="btn-primary" to="/admin/settings/email-templates/new"><Plus className="w-4 h-4" />{copy.addTemplate}</Link></header>
    <DataTableToolbar searchValue={params.q} onSearchChange={(q) => setParams({ q: q.length >= 2 ? q : "" })} searchPlaceholder={copy.searchTemplate} resultCount={query.isSuccess ? total : undefined} hasActiveFilters={filtered} onReset={resetParams}><FilterPopover label={copy.status} activeCount={params.status ? 1 : 0} onReset={() => setParams({ status: "" })}><label className="text-xs font-semibold text-inkSoft">{copy.status}<select className="input-flat mt-1.5" value={params.status || ""} onChange={(e) => setParams({ status: e.target.value })}><option value="">{copy.allStatus}</option><option value="enabled">{copy.enabled}</option><option value="disabled">{copy.disabled}</option></select></label></FilterPopover><select className="min-h-[40px] rounded-lg border border-line bg-surface px-3 text-xs" value={params.sort} onChange={(e) => setParams({ sort: e.target.value })}><option value="key">Key A–Z</option><option value="-updated_at">{copy.updated} ↓</option><option value="updated_at">{copy.updated} ↑</option></select></DataTableToolbar>
    {query.isError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{copy.loadError}</div>}
    <div className="mt-4"><DataTable columns={columns} items={items} loading={query.isLoading} sort={params.sort} onSort={(sort) => setParams({ sort })} hasActiveFilters={filtered} emptyTitle={copy.noTemplates} emptyDescription={copy.templateSub} caption={copy.templateTitle} footer={<AdminPagination page={params.page} pageSize={params.page_size} total={total} onPageChange={(page) => setParams({ page }, { resetPage: false })} onPageSizeChange={(page_size) => setParams({ page_size })} />} /></div>
    <ConfirmActionDialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)} title={copy.remove} description={copy.deleteTemplate} destructive loading={mutation.isPending} onConfirm={() => mutation.mutate()} />
  </div>;
}
