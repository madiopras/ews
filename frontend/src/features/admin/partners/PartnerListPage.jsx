import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, ExternalLink, Eye, FileCheck2, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AdminPagination, ConfirmActionDialog, DataTable, DataTableToolbar, FilterPopover, StatusBadge } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import useAdminListParams from "../../../hooks/useAdminListParams.js";
import { formatError } from "../../../lib/api.js";
import { deletePartner, listAdminPartners, togglePartner } from "./partnerApi.js";
import { PARTNER_TYPES } from "./partnerSchema.js";

const LIST_OPTIONS = {
  defaultSort: "-created_at",
  allowedSorts: ["business_name", "-business_name", "city", "-city", "type", "-type", "status", "-status", "created_at", "-created_at", "updated_at", "-updated_at"],
  filterKeys: ["type", "approval", "status", "premium"],
};

function ApprovalBadge({ status, copy }) {
  const variants = { approved: "success", rejected: "danger", pending: "warning", needs_revision: "warning", draft: "neutral" };
  return <StatusBadge variant={variants[status] || "neutral"}>{copy[status] || status}</StatusBadge>;
}

function PartnerActions({ item, copy, onAction }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link to={`/partners/${item.id}?lang=id`} target="_blank" className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`Public ID: ${item.business_name}`}><ExternalLink className="w-4 h-4" /></Link>
      <Link to={`/partners/${item.id}?lang=en&preview=admin`} target="_blank" className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`Preview EN: ${item.business_name}`}>EN</Link>
      <Link to={`/admin/partners/${item.id}`} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`${copy.detailTitle}: ${item.business_name}`}><Eye className="w-4 h-4" /></Link>
      <Link to={`/admin/partners/${item.id}/edit`} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`${copy.editTitle}: ${item.business_name}`}><Pencil className="w-4 h-4" /></Link>
      <button type="button" onClick={() => onAction("toggle", item)} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`${copy.toggleTitle}: ${item.business_name}`}>
        {item.is_active === false ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
      </button>
      <button type="button" onClick={() => onAction("delete", item)} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-red-700 hover:bg-red-50" aria-label={`${copy.deleteTitle}: ${item.business_name}`}><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

export default function PartnerListPage() {
  const { t, lang } = useLang();
  const copy = t.admin.partnerAdmin;
  const queryClient = useQueryClient();
  const { params, apiParams, setParams, resetParams } = useAdminListParams(LIST_OPTIONS);
  const [pendingAction, setPendingAction] = useState(null);
  const locale = lang === "id" ? "id-ID" : "en-US";
  const partnerQuery = useQuery({
    queryKey: ["admin", "partners", "list", apiParams],
    queryFn: ({ signal }) => listAdminPartners(apiParams, signal),
  });
  const actionMutation = useMutation({
    mutationFn: ({ type, item }) => type === "delete" ? deletePartner(item.id) : togglePartner(item.id),
    onSuccess: async (_, variables) => {
      if (variables.type === "delete" && partnerQuery.data?.items?.length === 1 && params.page > 1) setParams({ page: params.page - 1 }, { resetPage: false });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "partners"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      ]);
      toast.success(variables.type === "delete" ? copy.deleted : (variables.item.is_active === false ? t.admin.activated : t.admin.deactivated));
      setPendingAction(null);
    },
    onError: (error, variables) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : (variables.type === "delete" ? copy.deleteError : t.admin.toggleError)),
  });
  const items = partnerQuery.data?.items || [];
  const total = partnerQuery.data?.total || 0;
  const hasActiveFilters = Boolean(params.q || params.type || params.approval || params.status || params.premium);
  const activeFilterCount = [params.type, params.approval, params.status, params.premium].filter(Boolean).length;

  const columns = useMemo(() => [
    {
      key: "business_name", header: copy.business, sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3 min-w-[210px]">
          <div className="w-12 h-12 rounded-lg border border-line bg-line/30 overflow-hidden shrink-0">{item.image && <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover" />}</div>
          <div className="min-w-0">
            <div className="font-semibold truncate max-w-[220px]">{item.business_name}</div>
            <div className="text-[11px] text-inkSoft truncate max-w-[220px]">{item.email || item.whatsapp}</div>
          </div>
          {item.is_premium && <Crown className="w-4 h-4 text-amber-600 shrink-0" aria-label="Premium" />}
        </div>
      ),
    },
    { key: "type", header: copy.type, sortable: true, render: (item) => t.partners.types[item.type] || item.type },
    { key: "city", header: copy.city, sortable: true },
    { key: "approval", header: copy.approval, sortKey: "status", sortable: true, render: (item) => <ApprovalBadge status={item.status} copy={copy} /> },
    { key: "active", header: copy.status, render: (item) => <StatusBadge variant={item.is_active === false ? "danger" : "success"}>{item.is_active === false ? copy.inactive : copy.active}</StatusBadge> },
    { key: "documents", header: copy.documents, render: (item) => <span className="inline-flex items-center gap-1.5"><FileCheck2 className="w-4 h-4 text-inkSoft" /> {item.documents_count}</span> },
    { key: "updated_at", header: copy.updated, sortable: true, render: (item) => item.updated_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.updated_at)) : "-" },
    { key: "actions", header: copy.actions, headerClassName: "text-right", cellClassName: "text-right", mobile: false, render: (item) => <PartnerActions item={item} copy={copy} onAction={(type, target) => setPendingAction({ type, item: target })} /> },
  ], [copy, locale, t]);

  const mobileCard = (item) => (
    <article className="p-4" data-testid={`partner-list-card-${item.id}`}>
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-lg border border-line bg-line/30 overflow-hidden shrink-0">{item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}</div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{item.business_name}</h3>
          <p className="text-[11px] text-inkSoft mt-1">{t.partners.types[item.type]} · {item.city}</p>
          <div className="flex flex-wrap gap-1.5 mt-2"><ApprovalBadge status={item.status} copy={copy} /><StatusBadge variant={item.is_active === false ? "danger" : "success"}>{item.is_active === false ? copy.inactive : copy.active}</StatusBadge></div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-line flex justify-end"><PartnerActions item={item} copy={copy} onAction={(type, target) => setPendingAction({ type, item: target })} /></div>
    </article>
  );

  return (
    <div className="app-gutter w-full py-6 pb-16" data-testid="partner-list-page">
      <header className="mb-5 flex items-end justify-between flex-wrap gap-3">
        <div><div className="eyebrow">Admin</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">{copy.title}</h1><p className="text-[13px] text-inkSoft mt-2">{copy.subtitle}</p></div>
        <Link to="/admin/partners/new" className="btn-primary w-full sm:w-auto" data-testid="add-partner"><Plus className="w-4 h-4" /> {copy.add}</Link>
      </header>
      <div className="space-y-4">
        <DataTableToolbar searchValue={params.q} onSearchChange={(value) => setParams({ q: value.length >= 2 ? value : "" })} searchPlaceholder={copy.search} resultCount={partnerQuery.isSuccess ? total : undefined} hasActiveFilters={hasActiveFilters} onReset={resetParams}>
          <FilterPopover label={copy.filters} activeCount={activeFilterCount} onReset={() => setParams({ type: "", approval: "", status: "", premium: "" })}>
            <label className="block text-[11px] font-semibold text-inkSoft">{copy.type}<select value={params.type || ""} onChange={(event) => setParams({ type: event.target.value })} className="input-flat mt-1.5"><option value="">{copy.allTypes}</option>{PARTNER_TYPES.map((type) => <option key={type} value={type}>{t.partners.types[type]}</option>)}</select></label>
            <label className="block text-[11px] font-semibold text-inkSoft">{copy.approval}<select value={params.approval || ""} onChange={(event) => setParams({ approval: event.target.value })} className="input-flat mt-1.5"><option value="">{copy.allApprovals}</option><option value="draft">{copy.draft}</option><option value="pending">{copy.pending}</option><option value="needs_revision">{copy.needs_revision}</option><option value="approved">{copy.approved}</option><option value="rejected">{copy.rejected}</option></select></label>
            <label className="block text-[11px] font-semibold text-inkSoft">{copy.status}<select value={params.status || ""} onChange={(event) => setParams({ status: event.target.value })} className="input-flat mt-1.5"><option value="">{copy.allStatuses}</option><option value="active">{copy.active}</option><option value="inactive">{copy.inactive}</option></select></label>
            <label className="block text-[11px] font-semibold text-inkSoft">Premium<select value={params.premium || ""} onChange={(event) => setParams({ premium: event.target.value })} className="input-flat mt-1.5"><option value="">{copy.allPremium}</option><option value="true">{copy.premiumOnly}</option><option value="false">{copy.standardOnly}</option></select></label>
          </FilterPopover>
          <select value={params.sort} onChange={(event) => setParams({ sort: event.target.value })} className="min-h-[40px] rounded-lg border border-line bg-surface px-3 text-[12px]" aria-label={t.admin.dataTable.sortBy}>
            <option value="-created_at">{copy.updated}: ↓</option><option value="created_at">{copy.updated}: ↑</option><option value="business_name">{copy.business}: A–Z</option><option value="-business_name">{copy.business}: Z–A</option><option value="city">{copy.city}: A–Z</option>
          </select>
        </DataTableToolbar>
        {partnerQuery.isError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700" role="alert">{copy.loadError}</div>}
        <DataTable columns={columns} items={items} loading={partnerQuery.isLoading} sort={params.sort} onSort={(sort) => setParams({ sort })} renderMobileCard={mobileCard} hasActiveFilters={hasActiveFilters} emptyTitle={hasActiveFilters ? copy.noResultsTitle : copy.emptyTitle} emptyDescription={hasActiveFilters ? copy.noResultsDescription : copy.emptyDescription} caption={copy.title} footer={<AdminPagination page={params.page} pageSize={params.page_size} total={total} onPageChange={(page) => setParams({ page }, { resetPage: false })} onPageSizeChange={(page_size) => setParams({ page_size })} />} />
      </div>
      <ConfirmActionDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)} title={pendingAction?.type === "delete" ? copy.deleteTitle : copy.toggleTitle} description={pendingAction?.type === "delete" ? copy.deleteDescription : copy.toggleDescription} confirmLabel={pendingAction?.type === "delete" ? t.admin.delete : (pendingAction?.item?.is_active === false ? t.admin.activate : t.admin.deactivate)} destructive={pendingAction?.type === "delete"} loading={actionMutation.isPending} onConfirm={() => actionMutation.mutate(pendingAction)} />
    </div>
  );
}
