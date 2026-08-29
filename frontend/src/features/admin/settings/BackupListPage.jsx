import React, { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPagination, ConfirmActionDialog, DataTable, DataTableToolbar, FilterPopover, StatusBadge } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import useAdminListParams from "../../../hooks/useAdminListParams.js";
import { formatError } from "../../../lib/api.js";
import { createBackup, deleteBackup, downloadBackup, getBackupStatus, listBackups } from "./settingsApi.js";

const OPTIONS = { defaultSort: "-created_at", allowedSorts: ["created_at", "-created_at", "filename", "-filename", "size_bytes", "-size_bytes", "status", "-status"], filterKeys: ["status"] };
const bytes = (value) => value ? `${(value / 1024 / 1024).toFixed(2)} MB` : "-";
export default function BackupListPage() {
  const { lang, t } = useLang(); const copy = t.admin.settings; const qc = useQueryClient(); const { params, apiParams, setParams, resetParams } = useAdminListParams(OPTIONS); const [target, setTarget] = useState(null);
  const query = useQuery({ queryKey: ["admin", "backups", apiParams], queryFn: ({ signal }) => listBackups(apiParams, signal), refetchInterval: (state) => state.state.data?.items?.some((item) => ["pending", "processing"].includes(item.status)) ? 2000 : false });
  const status = useQuery({ queryKey: ["admin", "backups", "status"], queryFn: ({ signal }) => getBackupStatus(signal) });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["admin", "backups"] })]);
  const createMutation = useMutation({ mutationFn: createBackup, onSuccess: async () => { await refresh(); toast.success(copy.backupStarted); }, onError: (e) => toast.error(formatError(e.response?.data?.detail || copy.actionError)) });
  const deleteMutation = useMutation({ mutationFn: () => deleteBackup(target.id), onSuccess: async () => { await refresh(); setTarget(null); toast.success(copy.backupDeleted); }, onError: (e) => toast.error(formatError(e.response?.data?.detail || copy.actionError)) });
  const download = useCallback(async (item) => { try { const blob = await downloadBackup(item.id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = item.filename; anchor.click(); URL.revokeObjectURL(url); } catch (e) { toast.error(formatError(e.response?.data?.detail || copy.actionError)); } }, [copy.actionError]);
  const items = query.data?.items || []; const total = query.data?.total || 0; const filtered = Boolean(params.q || params.status);
  const columns = useMemo(() => [
    { key: "filename", header: copy.filename, sortable: true, render: (item) => <div className="flex gap-3 items-center min-w-[260px]"><span className="w-9 h-9 rounded-lg bg-line/30 text-toba flex items-center justify-center"><Archive className="w-4 h-4" /></span><div className="font-mono text-[11px] break-all">{item.filename}</div></div> },
    { key: "status", header: copy.status, sortable: true, render: (item) => <StatusBadge variant={item.status === "completed" ? "success" : item.status === "error" ? "danger" : "info"}>{copy[item.status] || item.status}</StatusBadge> },
    { key: "size_bytes", header: copy.size, sortable: true, render: (item) => bytes(item.size_bytes) },
    { key: "documents", header: copy.documents, render: (item) => item.document_count ?? "-" },
    { key: "created_by", header: copy.createdBy, render: (item) => item.created_by_email || "-" },
    { key: "created_at", header: copy.createdAt, sortable: true, render: (item) => item.created_at ? new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)) : "-" },
    { key: "actions", header: "", mobile: false, cellClassName: "text-right", render: (item) => <div className="flex justify-end gap-1"><button type="button" disabled={item.status !== "completed"} className="w-9 h-9 rounded-lg hover:bg-line/30 disabled:opacity-30 inline-flex items-center justify-center" onClick={() => download(item)} aria-label={copy.download}><Download className="w-4 h-4" /></button><button type="button" disabled={["pending", "processing"].includes(item.status)} className="w-9 h-9 rounded-lg hover:bg-red-50 text-red-700 disabled:opacity-30 inline-flex items-center justify-center" onClick={() => setTarget(item)} aria-label={copy.remove}><Trash2 className="w-4 h-4" /></button></div> },
  ], [copy, download, lang]);
  return <div className="app-gutter w-full py-6 pb-16" data-testid="backup-list-page"><header className="mb-5 flex items-end justify-between flex-wrap gap-3"><div><div className="eyebrow">Admin · Settings</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl">{copy.backupTitle}</h1><p className="text-[13px] text-inkSoft mt-2">{copy.backupSub}</p></div><div className="flex gap-2"><button type="button" aria-label={t.admin.settings.refresh} className="btn-outline" onClick={refresh}><RefreshCw className="w-4 h-4" /></button><button type="button" className="btn-primary" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}><Plus className="w-4 h-4" />{copy.createBackup}</button></div></header>
    <div className="mb-4 flex gap-2 items-center text-xs text-inkSoft"><span className={`w-2 h-2 rounded-full ${status.data?.directory_ready ? "bg-emerald-500" : "bg-red-500"}`} />{copy.directoryReady}: {status.data?.directory_ready ? copy.healthy : copy.error} · {status.data?.format || "-"}</div>
    <DataTableToolbar searchValue={params.q} onSearchChange={(q) => setParams({ q: q.length >= 2 ? q : "" })} searchPlaceholder={copy.searchBackup} resultCount={query.isSuccess ? total : undefined} hasActiveFilters={filtered} onReset={resetParams}><FilterPopover label={copy.status} activeCount={params.status ? 1 : 0} onReset={() => setParams({ status: "" })}><label className="text-xs font-semibold text-inkSoft">{copy.status}<select className="input-flat mt-1.5" value={params.status || ""} onChange={(e) => setParams({ status: e.target.value })}><option value="">{copy.allStatus}</option><option value="completed">{copy.completed}</option><option value="processing">{copy.processing}</option><option value="pending">{copy.pending}</option><option value="error">{copy.error}</option></select></label></FilterPopover></DataTableToolbar>
    {query.isError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{copy.loadError}</div>}
    <div className="mt-4"><DataTable columns={columns} items={items} loading={query.isLoading} sort={params.sort} onSort={(sort) => setParams({ sort })} hasActiveFilters={filtered} emptyTitle={copy.noBackups} emptyDescription={copy.backupSub} caption={copy.backupTitle} footer={<AdminPagination page={params.page} pageSize={params.page_size} total={total} onPageChange={(page) => setParams({ page }, { resetPage: false })} onPageSizeChange={(page_size) => setParams({ page_size })} />} /></div>
    <ConfirmActionDialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)} title={copy.remove} description={copy.deleteBackup} destructive loading={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate()} />
  </div>;
}
