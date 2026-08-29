import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FileCheck2, History, Mail, MapPin, MessageCircle, Pencil, Power, PowerOff, RotateCcw, ShieldAlert, Trash2, UserRoundCog, XCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmActionDialog, StatusBadge } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { formatError } from "../../../lib/api.js";
import PartnerApprovalHistory from "./PartnerApprovalHistory.jsx";
import PartnerDocuments from "./PartnerDocuments.jsx";
import { assignPartnerOwner, deletePartner, getAdminPartner, listDestinationOptions, setPartnerApproval, togglePartner } from "./partnerApi.js";

export default function PartnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLang();
  const copy = t.admin.partnerAdmin;
  const [tab, setTab] = useState("overview");
  const [pendingAction, setPendingAction] = useState(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const detailQuery = useQuery({ queryKey: ["admin", "partners", "detail", id], queryFn: ({ signal }) => getAdminPartner(id, signal) });
  const destinationsQuery = useQuery({ queryKey: ["admin", "destinations", "options"], queryFn: ({ signal }) => listDestinationOptions(signal), staleTime: 60_000 });
  const actionMutation = useMutation({
    mutationFn: ({ type }) => type === "delete" ? deletePartner(id) : type === "toggle" ? togglePartner(id) : setPartnerApproval(id, type, revisionNote),
    onSuccess: async (data, variables) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin", "partners"] }), queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })]);
      setPendingAction(null);
      setRevisionNote("");
      if (variables.type === "delete") {
        toast.success(copy.deleted);
        navigate("/admin/partners", { replace: true });
      } else {
        queryClient.setQueryData(["admin", "partners", "detail", id], data);
        toast.success(variables.type === "toggle" ? (data.is_active ? t.admin.activated : t.admin.deactivated) : copy[data.status]);
      }
    },
    onError: (error, variables) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : (variables.type === "delete" ? copy.deleteError : t.admin.toggleError)),
  });
  const ownerMutation = useMutation({
    mutationFn: () => assignPartnerOwner(id, ownerEmail.trim()),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "partners", "detail", id], data);
      queryClient.invalidateQueries({ queryKey: ["admin", "partners", "list"] });
      setOwnerEmail("");
      toast.success(copy.ownerAssigned);
    },
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.ownerAssignError),
  });
  const partner = detailQuery.data;
  const destinationMap = new Map((destinationsQuery.data || []).map((item) => [item.id, item.name]));
  const approvalVariant = { approved: "success", rejected: "danger", pending: "warning", needs_revision: "warning", draft: "neutral" };
  const actionCopy = pendingAction?.type === "delete" ? [copy.deleteTitle, copy.deleteDescription, t.admin.delete]
    : pendingAction?.type === "toggle" ? [copy.toggleTitle, copy.toggleDescription, partner?.is_active === false ? t.admin.activate : t.admin.deactivate]
      : pendingAction?.type === "approved" ? [copy.approveTitle, copy.approveDescription, copy.approve]
        : pendingAction?.type === "rejected" ? [copy.rejectTitle, copy.rejectDescription, copy.reject]
          : pendingAction?.type === "needs_revision" ? [copy.revisionTitle, copy.revisionDescription, copy.requestRevision]
          : [copy.pendingTitle, copy.pendingDescription, copy.returnPending];

  if (detailQuery.isLoading) return <div className="app-gutter py-8 text-[13px] text-inkSoft">{copy.loadingDetail}</div>;
  if (detailQuery.isError || !partner) return <div className="app-gutter py-8"><div className="card-flat p-5 text-center text-red-700 sm:p-6">{copy.detailError}</div></div>;

  const tabs = [
    { id: "overview", label: copy.overviewTab, icon: MapPin },
    { id: "documents", label: `${copy.documentsTab} (${partner.verification_documents?.length || 0})`, icon: FileCheck2 },
    { id: "history", label: `${copy.historyTab} (${partner.approval_history?.length || 0})`, icon: History },
  ];
  const updatePartnerFromDocument = (data) => {
    queryClient.setQueryData(["admin", "partners", "detail", id], data);
    queryClient.invalidateQueries({ queryKey: ["admin", "partners", "list"] });
  };
  return (
    <div className="app-gutter w-full py-6 pb-16" data-testid="partner-detail-page">
      <Link to="/admin/partners" className="inline-flex items-center gap-2 text-[12px] text-inkSoft hover:text-toba mb-4"><ArrowLeft className="w-4 h-4" /> {copy.title}</Link>
      <header className="card-flat p-4 sm:p-6 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="w-20 h-20 rounded-xl border border-line bg-line/30 overflow-hidden shrink-0">{partner.image && <img src={partner.image} alt="" className="w-full h-full object-cover" />}</div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl sm:text-3xl">{partner.business_name}</h1><StatusBadge variant={approvalVariant[partner.status]}>{copy[partner.status]}</StatusBadge><StatusBadge variant={partner.is_active === false ? "danger" : "success"}>{partner.is_active === false ? copy.inactive : copy.active}</StatusBadge></div>
            <p className="text-[12px] text-inkSoft mt-2">{t.partners.types[partner.type]} · {partner.city}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/partners/${id}/edit`} className="btn-outline"><Pencil className="w-4 h-4" /> {copy.edit}</Link>
            <button type="button" onClick={() => setPendingAction({ type: "toggle" })} className="btn-outline">{partner.is_active === false ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}{partner.is_active === false ? t.admin.activate : t.admin.deactivate}</button>
            <button type="button" onClick={() => setPendingAction({ type: "delete" })} className="btn-outline text-red-700"><Trash2 className="w-4 h-4" /> {t.admin.delete}</button>
          </div>
        </div>
        <div className="mt-5 pt-5 border-t border-line flex flex-wrap gap-2">
          {partner.status !== "approved" && <button type="button" onClick={() => setPendingAction({ type: "approved" })} className="btn-primary"><Check className="w-4 h-4" /> {copy.approve}</button>}
          {partner.status !== "rejected" && <button type="button" onClick={() => setPendingAction({ type: "rejected" })} className="btn-outline text-red-700"><XCircle className="w-4 h-4" /> {copy.reject}</button>}
          {partner.status !== "needs_revision" && <button type="button" onClick={() => setPendingAction({ type: "needs_revision" })} className="btn-outline text-orange-800"><ShieldAlert className="w-4 h-4" /> {copy.requestRevision}</button>}
          {partner.status !== "pending" && <button type="button" onClick={() => setPendingAction({ type: "pending" })} className="btn-outline"><RotateCcw className="w-4 h-4" /> {copy.returnPending}</button>}
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-line mb-5" role="tablist">
        {tabs.map(({ id: tabId, label, icon: Icon }) => <button key={tabId} type="button" onClick={() => setTab(tabId)} role="tab" aria-selected={tab === tabId} className={`min-h-[44px] px-4 inline-flex items-center gap-2 text-[12px] font-semibold border-b-2 whitespace-nowrap ${tab === tabId ? "border-toba text-toba" : "border-transparent text-inkSoft"}`}><Icon className="w-4 h-4" />{label}</button>)}
      </div>

      {tab === "documents" ? <PartnerDocuments partner={partner} onUpdated={updatePartnerFromDocument} />
        : tab === "history" ? <PartnerApprovalHistory history={partner.approval_history} />
          : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <section className="card-flat p-5 xl:col-span-2"><h2 className="font-display text-xl">{copy.profileSection}</h2><p className="text-[13px] text-inkSoft leading-relaxed mt-4 whitespace-pre-line">{partner.description}</p><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5"><div><dt className="text-[11px] text-inkSoft">{copy.contact}</dt><dd className="mt-1 text-sm space-y-1"><span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-toba" />{partner.whatsapp}</span>{partner.email && <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-toba" />{partner.email}</span>}</dd></div><div><dt className="text-[11px] text-inkSoft">{copy.address}</dt><dd className="mt-1 text-sm">{partner.address || partner.city}</dd></div></dl></section>
              <div className="space-y-4"><section className="card-flat p-5"><h2 className="font-display text-xl">{copy.destinationsServed}</h2><div className="flex flex-wrap gap-2 mt-4">{partner.destination_ids.length === 0 ? <span className="text-[12px] text-inkSoft">{copy.noDestinations}</span> : partner.destination_ids.map((destinationId) => <span key={destinationId} className="chip">{destinationMap.get(destinationId) || destinationId}</span>)}</div></section><section className="card-flat p-5"><div className="flex items-center gap-2"><UserRoundCog className="w-5 h-5 text-toba" /><h2 className="font-display text-xl">{copy.ownership}</h2></div><p className="mt-2 text-[12px] text-inkSoft">{partner.ownership_status === "claimed" ? `${copy.claimed}: ${partner.owner_user_id}` : copy.unclaimed}</p><form onSubmit={(event) => { event.preventDefault(); ownerMutation.mutate(); }} className="mt-4 space-y-2"><input type="email" required value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} className="input-flat" placeholder={copy.ownerEmail} /><button type="submit" disabled={ownerMutation.isPending} className="btn-outline w-full">{copy.assignOwner}</button></form></section></div>
            </div>
          )}
      <ConfirmActionDialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) { setPendingAction(null); setRevisionNote(""); } }} title={actionCopy[0]} description={actionCopy[1]} confirmLabel={actionCopy[2]} destructive={["delete", "rejected"].includes(pendingAction?.type)} loading={actionMutation.isPending} onConfirm={() => actionMutation.mutate(pendingAction)} content={["needs_revision", "rejected"].includes(pendingAction?.type) ? <label className="block text-[12px] font-semibold text-inkSoft">{copy.revisionNote}<textarea required={pendingAction?.type === "needs_revision"} minLength={pendingAction?.type === "needs_revision" ? 5 : 0} rows={4} value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} className="input-flat mt-2 resize-y" /></label> : null} />
    </div>
  );
}
