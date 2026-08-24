import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPagination, ConfirmActionDialog, DataTable, DataTableToolbar, FilterPopover, StatusBadge } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import useAdminListParams from "../../../hooks/useAdminListParams.js";
import { formatError } from "../../../lib/api.js";
import { createPlan, deletePlan, listAdminPlans, updatePlan } from "./planApi.js";
import PlanFormDrawer from "./PlanFormDrawer.jsx";
import { planToPayload } from "./planSchema.js";

const LIST_OPTIONS = { defaultSort: "order", allowedSorts: ["code", "-code", "label_id", "-label_id", "months", "-months", "price", "-price", "order", "-order", "created_at", "-created_at"], filterKeys: ["status"] };

export default function PlanListPage() {
  const { t, lang } = useLang();
  const copy = t.admin.planAdmin;
  const queryClient = useQueryClient();
  const { params, apiParams, setParams, resetParams } = useAdminListParams(LIST_OPTIONS);
  const [editing, setEditing] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const locale = lang === "id" ? "id-ID" : "en-US";
  const plansQuery = useQuery({ queryKey: ["admin", "plans", "list", apiParams], queryFn: ({ signal }) => listAdminPlans(apiParams, signal) });
  const saveMutation = useMutation({
    mutationFn: (values) => editing?.id ? updatePlan(editing.id, planToPayload(values)) : createPlan(planToPayload(values)),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }); toast.success(copy.saved); setDrawerOpen(false); setEditing(null); },
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.saveError),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deletePlan(deleteTarget.id),
    onSuccess: async () => { if (plansQuery.data?.items?.length === 1 && params.page > 1) setParams({ page: params.page - 1 }, { resetPage: false }); await queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }); toast.success(copy.deleted); setDeleteTarget(null); },
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.deleteError),
  });
  const items = plansQuery.data?.items || [];
  const total = plansQuery.data?.total || 0;
  const hasActiveFilters = Boolean(params.q || params.status);
  const columns = useMemo(() => [
    { key: "order", header: copy.order, sortable: true, render: (item) => <span className="font-semibold">#{item.order}</span> },
    { key: "label_id", header: copy.label, sortable: true, render: (item) => <div className="min-w-[200px]"><div className="font-semibold">{item.label_id}</div><div className="text-[11px] text-inkSoft mt-1">{item.label_en}</div></div> },
    { key: "code", header: copy.code, sortable: true, render: (item) => <code className="rounded bg-line/30 px-2 py-1 text-[11px]">{item.code}</code> },
    { key: "months", header: copy.duration, sortable: true, render: (item) => `${item.months} ${copy.months}` },
    { key: "price", header: copy.price, sortable: true, render: (item) => new Intl.NumberFormat(locale, { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.price) },
    { key: "status", header: copy.status, render: (item) => <StatusBadge variant={item.active ? "success" : "danger"}>{item.active ? copy.active : copy.inactive}</StatusBadge> },
    { key: "actions", header: copy.actions, headerClassName: "text-right", cellClassName: "text-right", mobile: false, render: (item) => <div className="flex justify-end gap-1"><button type="button" onClick={() => { setEditing(item); setDrawerOpen(true); }} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`${copy.edit}: ${item.code}`}><Pencil className="w-4 h-4" /></button><button type="button" onClick={() => setDeleteTarget(item)} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-red-700 hover:bg-red-50" aria-label={`${copy.deleteTitle}: ${item.code}`}><Trash2 className="w-4 h-4" /></button></div> },
  ], [copy, locale]);
  const mobileCard = (item) => <article className="p-4"><div className="flex items-start gap-3"><span className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center"><Crown className="w-5 h-5" /></span><div className="flex-1 min-w-0"><div className="font-semibold text-sm">{item.label_id}</div><div className="text-[11px] text-inkSoft mt-1">{item.code} · {item.months} {copy.months}</div><div className="mt-2"><StatusBadge variant={item.active ? "success" : "danger"}>{item.active ? copy.active : copy.inactive}</StatusBadge></div></div><div className="flex gap-1"><button type="button" onClick={() => { setEditing(item); setDrawerOpen(true); }} className="w-10 h-10 rounded-lg border border-line flex items-center justify-center" aria-label={`${copy.edit}: ${item.code}`}><Pencil className="w-4 h-4" /></button><button type="button" onClick={() => setDeleteTarget(item)} className="w-10 h-10 rounded-lg border border-line flex items-center justify-center text-red-700" aria-label={`${copy.deleteTitle}: ${item.code}`}><Trash2 className="w-4 h-4" /></button></div></div></article>;

  return (
    <div className="w-full px-4 sm:px-6 xl:px-8 py-6 pb-16" data-testid="plan-list-page">
      <header className="mb-5 flex items-end justify-between flex-wrap gap-3"><div><div className="eyebrow">Admin</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl">{copy.title}</h1><p className="text-[13px] text-inkSoft mt-2">{copy.subtitle}</p></div><button type="button" onClick={() => { setEditing(null); setDrawerOpen(true); }} className="btn-primary w-full sm:w-auto" data-testid="plan-add-btn"><Plus className="w-4 h-4" />{copy.add}</button></header>
      <div className="space-y-4">
        <DataTableToolbar searchValue={params.q} onSearchChange={(value) => setParams({ q: value.length >= 2 ? value : "" })} searchPlaceholder={copy.search} resultCount={plansQuery.isSuccess ? total : undefined} hasActiveFilters={hasActiveFilters} onReset={resetParams}>
          <FilterPopover label={copy.filters} activeCount={params.status ? 1 : 0} onReset={() => setParams({ status: "" })}><label className="block text-[11px] font-semibold text-inkSoft">{copy.status}<select value={params.status || ""} onChange={(event) => setParams({ status: event.target.value })} className="input-flat mt-1.5"><option value="">{copy.allStatuses}</option><option value="active">{copy.active}</option><option value="inactive">{copy.inactive}</option></select></label></FilterPopover>
          <select value={params.sort} onChange={(event) => setParams({ sort: event.target.value })} className="min-h-[40px] rounded-lg border border-line bg-surface px-3 text-[12px]" aria-label={t.admin.dataTable.sortBy}><option value="order">{copy.order}: ↑</option><option value="-order">{copy.order}: ↓</option><option value="price">{copy.price}: ↑</option><option value="-price">{copy.price}: ↓</option><option value="label_id">{copy.label}: A–Z</option></select>
        </DataTableToolbar>
        {plansQuery.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[12px] text-red-700">{copy.loadError}</div>}
        <DataTable columns={columns} items={items} loading={plansQuery.isLoading} sort={params.sort} onSort={(sort) => setParams({ sort })} renderMobileCard={mobileCard} hasActiveFilters={hasActiveFilters} emptyTitle={hasActiveFilters ? copy.noResultsTitle : copy.emptyTitle} emptyDescription={hasActiveFilters ? copy.noResultsDescription : copy.emptyDescription} caption={copy.title} footer={<AdminPagination page={params.page} pageSize={params.page_size} total={total} onPageChange={(page) => setParams({ page }, { resetPage: false })} onPageSizeChange={(page_size) => setParams({ page_size })} />} />
      </div>
      <PlanFormDrawer open={drawerOpen} plan={editing} onOpenChange={(open) => { setDrawerOpen(open); if (!open) setEditing(null); }} onSave={(values) => saveMutation.mutate(values)} saving={saveMutation.isPending} />
      <ConfirmActionDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title={copy.deleteTitle} description={copy.deleteDescription} confirmLabel={t.admin.delete} destructive loading={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate()} />
    </div>
  );
}
