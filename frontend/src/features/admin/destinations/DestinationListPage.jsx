import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AdminPagination,
  ConfirmActionDialog,
  DataTable,
  DataTableToolbar,
  FilterPopover,
  StatusBadge,
} from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import useAdminListParams from "../../../hooks/useAdminListParams.js";
import { CATEGORY_KEYS } from "../../../lib/i18n.js";
import { formatError } from "../../../lib/api.js";
import { deleteDestination, listAdminDestinations, toggleDestination } from "./destinationApi.js";

const LIST_OPTIONS = {
  defaultSort: "-created_at",
  allowedSorts: ["name", "-name", "location", "-location", "price", "-price", "created_at", "-created_at", "updated_at", "-updated_at"],
  filterKeys: ["category", "status", "featured", "min_price", "max_price"],
};

function ActionButtons({ item, copy, onAction }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link to={`/destination/${item.id}?lang=id`} target="_blank" className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`${copy.name}: ${item.name}`}>
        <ExternalLink className="w-4 h-4" />
      </Link>
      <Link to={`/destination/${item.id}?lang=en&preview=admin`} target="_blank" className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`Preview EN: ${item.name}`}>EN</Link>
      <Link to={`/admin/destinations/${item.id}/edit`} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`${copy.editTitle}: ${item.name}`}>
        <Pencil className="w-4 h-4" />
      </Link>
      <button type="button" onClick={() => onAction("toggle", item)} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`${item.is_active === false ? copy.status : copy.status}: ${item.name}`}>
        {item.is_active === false ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
      </button>
      <button type="button" onClick={() => onAction("delete", item)} className="w-9 h-9 rounded-lg flex items-center justify-center text-inkSoft hover:text-red-700 hover:bg-red-50" aria-label={`${copy.deleteTitle}: ${item.name}`}>
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function DestinationListPage() {
  const { t, lang } = useLang();
  const copy = t.admin.destinationAdmin;
  const queryClient = useQueryClient();
  const { params, apiParams, setParams, resetParams } = useAdminListParams(LIST_OPTIONS);
  const [pendingAction, setPendingAction] = useState(null);
  const locale = lang === "id" ? "id-ID" : "en-US";
  const status = params.status || "all";
  const destinationQuery = useQuery({
    queryKey: ["admin", "destinations", "list", apiParams],
    queryFn: ({ signal }) => listAdminDestinations(apiParams, signal),
  });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin", "destinations"] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
  ]);
  const actionMutation = useMutation({
    mutationFn: ({ type, item }) => type === "delete" ? deleteDestination(item.id) : toggleDestination(item.id),
    onSuccess: async (_, variables) => {
      if (variables.type === "delete" && destinationQuery.data?.items?.length === 1 && params.page > 1) {
        setParams({ page: params.page - 1 }, { resetPage: false });
      }
      await refresh();
      toast.success(variables.type === "delete" ? copy.deleted : (variables.item.is_active === false ? t.admin.activated : t.admin.deactivated));
      setPendingAction(null);
    },
    onError: (error, variables) => toast.error(
      error.response?.data?.detail
        ? formatError(error.response.data.detail)
        : (variables.type === "delete" ? copy.deleteError : t.admin.toggleError),
    ),
  });
  const items = destinationQuery.data?.items || [];
  const total = destinationQuery.data?.total || 0;
  const hasActiveFilters = Boolean(params.q || params.category || (params.status && params.status !== "all") || params.featured || params.min_price || params.max_price);
  const activeFilterCount = [params.category, params.status && params.status !== "all", params.featured, params.min_price, params.max_price].filter(Boolean).length;

  const columns = useMemo(() => [
    {
      key: "name",
      header: copy.name,
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3 min-w-[210px]">
          <div className="w-12 h-12 rounded-lg border border-line bg-line/30 overflow-hidden shrink-0">
            {item.images?.[0] ? <img src={item.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate max-w-[230px]">{item.name}</div>
            {item.name_en && <div className="text-[11px] text-inkSoft truncate max-w-[230px]">{item.name_en}</div>}
          </div>
        </div>
      ),
    },
    { key: "location", header: copy.location, sortable: true, cellClassName: "max-w-[190px]", render: (item) => <span className="line-clamp-2">{item.location}</span> },
    { key: "category", header: copy.category, render: (item) => t.categories[item.category] || item.category },
    { key: "price", header: copy.price, sortable: true, render: (item) => new Intl.NumberFormat(locale, { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.price || 0) },
    { key: "featured", header: copy.featured, render: (item) => <StatusBadge variant={item.featured ? "info" : "neutral"} dot={item.featured}>{item.featured ? copy.yes : copy.no}</StatusBadge> },
    { key: "status", header: copy.status, render: (item) => <StatusBadge variant={item.is_active === false ? "danger" : "success"}>{item.is_active === false ? t.admin.inactive : t.admin.active}</StatusBadge> },
    { key: "updated_at", header: copy.updated, sortable: true, render: (item) => item.updated_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.updated_at)) : "-" },
    { key: "actions", header: copy.actions, headerClassName: "text-right", cellClassName: "text-right", mobile: false, render: (item) => <ActionButtons item={item} copy={copy} onAction={(type, target) => setPendingAction({ type, item: target })} /> },
  ], [copy, locale, t]);

  const mobileCard = (item) => (
    <article className="p-4" data-testid={`destination-card-${item.id}`}>
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg border border-line bg-line/30 overflow-hidden shrink-0">
          {item.images?.[0] ? <img src={item.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{item.name}</h3>
          <p className="text-[11px] text-inkSoft mt-1 truncate">{item.location}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <StatusBadge variant={item.is_active === false ? "danger" : "success"}>{item.is_active === false ? t.admin.inactive : t.admin.active}</StatusBadge>
            {item.featured && <StatusBadge variant="info">{copy.featured}</StatusBadge>}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold">{new Intl.NumberFormat(locale, { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.price || 0)}</span>
        <ActionButtons item={item} copy={copy} onAction={(type, target) => setPendingAction({ type, item: target })} />
      </div>
    </article>
  );

  return (
    <div className="app-gutter w-full py-6 pb-16" data-testid="destination-list-page">
      <header className="mb-5 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">{copy.title}</h1>
          <p className="text-[13px] text-inkSoft mt-2">{copy.subtitle}</p>
        </div>
        <Link to="/admin/destinations/new" className="btn-primary w-full sm:w-auto" data-testid="add-destination">
          <Plus className="w-4 h-4" /> {copy.add}
        </Link>
      </header>

      <div className="space-y-4">
        <DataTableToolbar
          searchValue={params.q}
          onSearchChange={(value) => setParams({ q: value.length >= 2 ? value : "" })}
          searchPlaceholder={copy.search}
          resultCount={destinationQuery.isSuccess ? total : undefined}
          hasActiveFilters={hasActiveFilters}
          onReset={resetParams}
        >
          <FilterPopover label={copy.filters} activeCount={activeFilterCount} onReset={() => setParams({ category: "", status: "", featured: "", min_price: "", max_price: "" })}>
            <label className="block text-[11px] font-semibold text-inkSoft">
              {copy.category}
              <select value={params.category || ""} onChange={(event) => setParams({ category: event.target.value })} className="input-flat mt-1.5">
                <option value="">{copy.allCategories}</option>
                {CATEGORY_KEYS.map((category) => <option key={category} value={category}>{t.categories[category]}</option>)}
              </select>
            </label>
            <label className="block text-[11px] font-semibold text-inkSoft">
              {copy.status}
              <select value={status} onChange={(event) => setParams({ status: event.target.value === "all" ? "" : event.target.value })} className="input-flat mt-1.5">
                <option value="all">{copy.allStatuses}</option>
                <option value="active">{t.admin.active}</option>
                <option value="inactive">{t.admin.inactive}</option>
              </select>
            </label>
            <label className="block text-[11px] font-semibold text-inkSoft">
              {copy.featured}
              <select value={params.featured || ""} onChange={(event) => setParams({ featured: event.target.value })} className="input-flat mt-1.5">
                <option value="">{copy.allFeatured}</option>
                <option value="true">{copy.featuredOnly}</option>
                <option value="false">{copy.notFeatured}</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-semibold text-inkSoft">
                {copy.minPrice}
                <input type="number" min="0" value={params.min_price || ""} onChange={(event) => setParams({ min_price: event.target.value })} className="input-flat mt-1.5" />
              </label>
              <label className="block text-[11px] font-semibold text-inkSoft">
                {copy.maxPrice}
                <input type="number" min="0" value={params.max_price || ""} onChange={(event) => setParams({ max_price: event.target.value })} className="input-flat mt-1.5" />
              </label>
            </div>
          </FilterPopover>
          <select value={params.sort} onChange={(event) => setParams({ sort: event.target.value })} className="min-h-[40px] rounded-lg border border-line bg-surface px-3 text-[12px]" aria-label={t.admin.dataTable.sortBy}>
            <option value="-created_at">{copy.updated}: ↓</option>
            <option value="created_at">{copy.updated}: ↑</option>
            <option value="name">{copy.name}: A–Z</option>
            <option value="-name">{copy.name}: Z–A</option>
            <option value="price">{copy.price}: ↑</option>
            <option value="-price">{copy.price}: ↓</option>
          </select>
        </DataTableToolbar>

        {destinationQuery.isError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700" role="alert">{copy.loadError}</div>}
        <DataTable
          columns={columns}
          items={items}
          loading={destinationQuery.isLoading}
          sort={params.sort}
          onSort={(sort) => setParams({ sort })}
          renderMobileCard={mobileCard}
          hasActiveFilters={hasActiveFilters}
          emptyTitle={hasActiveFilters ? copy.noResultsTitle : copy.emptyTitle}
          emptyDescription={hasActiveFilters ? copy.noResultsDescription : copy.emptyDescription}
          caption={copy.title}
          footer={
            <AdminPagination
              page={params.page}
              pageSize={params.page_size}
              total={total}
              onPageChange={(page) => setParams({ page }, { resetPage: false })}
              onPageSizeChange={(page_size) => setParams({ page_size })}
            />
          }
        />
      </div>

      <ConfirmActionDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction?.type === "delete" ? copy.deleteTitle : copy.toggleTitle}
        description={pendingAction?.type === "delete" ? copy.deleteDescription : copy.toggleDescription}
        confirmLabel={pendingAction?.type === "delete" ? t.admin.delete : (pendingAction?.item?.is_active === false ? t.admin.activate : t.admin.deactivate)}
        destructive={pendingAction?.type === "delete"}
        loading={actionMutation.isPending}
        onConfirm={() => actionMutation.mutate(pendingAction)}
      />
    </div>
  );
}
