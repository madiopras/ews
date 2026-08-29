import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AdminPagination, DataTable, DataTableToolbar, FilterPopover, StatusBadge } from "../../../components/admin/index.js";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import useAdminListParams from "../../../hooks/useAdminListParams.js";
import { formatError } from "../../../lib/api.js";
import UserEditDrawer from "./UserEditDrawer.jsx";
import { listAdminUsers, updateAdminUser } from "./userApi.js";

const LIST_OPTIONS = {
  defaultSort: "-created_at",
  allowedSorts: ["name", "-name", "email", "-email", "role", "-role", "created_at", "-created_at", "updated_at", "-updated_at"],
  filterKeys: ["role", "status", "provider"],
};

export default function UserListPage() {
  const { user: currentUser } = useAuth();
  const { t, lang } = useLang();
  const copy = t.admin.userAdmin;
  const queryClient = useQueryClient();
  const { params, apiParams, setParams, resetParams } = useAdminListParams(LIST_OPTIONS);
  const [editing, setEditing] = useState(null);
  const locale = lang === "id" ? "id-ID" : "en-US";
  const usersQuery = useQuery({ queryKey: ["admin", "users", "list", apiParams], queryFn: ({ signal }) => listAdminUsers(apiParams, signal) });
  const updateMutation = useMutation({
    mutationFn: (changes) => updateAdminUser(editing.id, changes),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin", "users"] }), queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })]);
      toast.success(copy.saved);
      setEditing(null);
    },
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.saveError),
  });
  const items = usersQuery.data?.items || [];
  const total = usersQuery.data?.total || 0;
  const hasActiveFilters = Boolean(params.q || params.role || params.status || params.provider);
  const activeFilterCount = [params.role, params.status, params.provider].filter(Boolean).length;
  const columns = useMemo(() => [
    { key: "name", header: copy.name, sortable: true, render: (item) => <div className="flex items-center gap-3 min-w-[220px]"><span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.role === "admin" ? "bg-toba text-white" : "bg-line/40 text-inkSoft"}`}>{item.role === "admin" ? <Shield className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}</span><div className="min-w-0"><div className="font-semibold truncate max-w-[220px]">{item.name || copy.unnamed}{item.id === currentUser?.id && <span className="ml-2 text-[10px] text-toba">({copy.you})</span>}</div><div className="text-[11px] text-inkSoft truncate max-w-[220px]">{item.email}</div></div></div> },
    { key: "role", header: copy.role, sortable: true, render: (item) => <StatusBadge variant={item.role === "admin" ? "info" : "neutral"}>{item.role}</StatusBadge> },
    { key: "status", header: copy.status, render: (item) => <StatusBadge variant={item.account_active === false ? "danger" : "success"}>{item.account_active === false ? copy.inactive : copy.active}</StatusBadge> },
    { key: "provider", header: copy.provider, render: (item) => item.auth_provider || "password" },
    { key: "created_at", header: copy.registered, sortable: true, render: (item) => item.created_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.created_at)) : "-" },
    { key: "actions", header: copy.actions, headerClassName: "text-right", cellClassName: "text-right", mobile: false, render: (item) => <button type="button" onClick={() => setEditing(item)} className="w-9 h-9 ml-auto rounded-lg flex items-center justify-center text-inkSoft hover:text-toba hover:bg-line/30" aria-label={`${copy.edit}: ${item.email}`}><Pencil className="w-4 h-4" /></button> },
  ], [copy, currentUser?.id, locale]);
  const mobileCard = (item) => <article className="p-4 flex items-center gap-3"><div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{item.name || copy.unnamed}</div><div className="text-[11px] text-inkSoft truncate mt-1">{item.email}</div><div className="flex flex-wrap gap-1.5 mt-2"><StatusBadge variant={item.role === "admin" ? "info" : "neutral"}>{item.role}</StatusBadge><StatusBadge variant={item.account_active === false ? "danger" : "success"}>{item.account_active === false ? copy.inactive : copy.active}</StatusBadge></div></div><button type="button" onClick={() => setEditing(item)} className="w-10 h-10 rounded-lg border border-line flex items-center justify-center" aria-label={`${copy.edit}: ${item.email}`}><Pencil className="w-4 h-4" /></button></article>;

  return (
    <div className="app-gutter w-full py-6 pb-16" data-testid="user-list-page">
      <header className="mb-5"><div className="eyebrow">Admin</div><h1 className="mt-2 font-display text-[26px] sm:text-4xl">{copy.title}</h1><p className="text-[13px] text-inkSoft mt-2">{copy.subtitle}</p></header>
      <div className="space-y-4">
        <DataTableToolbar searchValue={params.q} onSearchChange={(value) => setParams({ q: value.length >= 2 ? value : "" })} searchPlaceholder={copy.search} resultCount={usersQuery.isSuccess ? total : undefined} hasActiveFilters={hasActiveFilters} onReset={resetParams}>
          <FilterPopover label={copy.filters} activeCount={activeFilterCount} onReset={() => setParams({ role: "", status: "", provider: "" })}>
            <label className="block text-[11px] font-semibold text-inkSoft">{copy.role}<select value={params.role || ""} onChange={(event) => setParams({ role: event.target.value })} className="input-flat mt-1.5"><option value="">{copy.allRoles}</option><option value="user">User</option><option value="partner">Partner</option><option value="admin">Admin</option></select></label>
            <label className="block text-[11px] font-semibold text-inkSoft">{copy.status}<select value={params.status || ""} onChange={(event) => setParams({ status: event.target.value })} className="input-flat mt-1.5"><option value="">{copy.allStatuses}</option><option value="active">{copy.active}</option><option value="inactive">{copy.inactive}</option></select></label>
            <label className="block text-[11px] font-semibold text-inkSoft">{copy.provider}<select value={params.provider || ""} onChange={(event) => setParams({ provider: event.target.value })} className="input-flat mt-1.5"><option value="">{copy.allProviders}</option><option value="password">Password</option><option value="google">Google</option></select></label>
          </FilterPopover>
          <select value={params.sort} onChange={(event) => setParams({ sort: event.target.value })} className="min-h-[40px] rounded-lg border border-line bg-surface px-3 text-[12px]" aria-label={t.admin.dataTable.sortBy}><option value="-created_at">{copy.registered}: ↓</option><option value="created_at">{copy.registered}: ↑</option><option value="name">{copy.name}: A–Z</option><option value="-name">{copy.name}: Z–A</option><option value="role">{copy.role}: A–Z</option></select>
        </DataTableToolbar>
        {usersQuery.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[12px] text-red-700">{copy.loadError}</div>}
        <DataTable columns={columns} items={items} loading={usersQuery.isLoading} sort={params.sort} onSort={(sort) => setParams({ sort })} renderMobileCard={mobileCard} hasActiveFilters={hasActiveFilters} emptyTitle={hasActiveFilters ? copy.noResultsTitle : copy.emptyTitle} emptyDescription={hasActiveFilters ? copy.noResultsDescription : copy.emptyDescription} caption={copy.title} footer={<AdminPagination page={params.page} pageSize={params.page_size} total={total} onPageChange={(page) => setParams({ page }, { resetPage: false })} onPageSizeChange={(page_size) => setParams({ page_size })} />} />
      </div>
      <UserEditDrawer user={editing} currentUserId={currentUser?.id} open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} onSave={(changes) => updateMutation.mutate(changes)} saving={updateMutation.isPending} />
    </div>
  );
}
