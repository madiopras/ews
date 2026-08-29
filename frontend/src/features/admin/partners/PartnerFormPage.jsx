import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { formatError } from "../../../lib/api.js";
import PartnerForm from "./PartnerForm.jsx";
import { createPartner, getAdminPartner, listDestinationOptions, updatePartner } from "./partnerApi.js";
import { partnerToPayload } from "./partnerSchema.js";

export default function PartnerFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLang();
  const copy = t.admin.partnerAdmin;
  const detailQuery = useQuery({
    queryKey: ["admin", "partners", "detail", id],
    queryFn: ({ signal }) => getAdminPartner(id, signal),
    enabled: editing,
  });
  const destinationsQuery = useQuery({
    queryKey: ["admin", "destinations", "options"],
    queryFn: ({ signal }) => listDestinationOptions(signal),
    staleTime: 60_000,
  });
  const saveMutation = useMutation({
    mutationFn: (values) => editing ? updatePartner(id, partnerToPayload(values)) : createPartner(partnerToPayload(values)),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "partners"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      ]);
      toast.success(copy.saved);
      navigate(`/admin/partners/${data.id}`, { replace: true });
    },
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.saveError),
  });

  if (editing && detailQuery.isLoading) return <div className="app-gutter py-8 text-[13px] text-inkSoft">{copy.loadingDetail}</div>;
  if (editing && detailQuery.isError) {
    return <div className="app-gutter py-8"><div className="card-flat p-5 text-center text-red-700 sm:p-6">{copy.detailError}</div></div>;
  }

  return (
    <div className="app-gutter w-full max-w-6xl py-6 pb-16" data-testid="partner-form-page">
      <header className="mb-6">
        <Link to={editing ? `/admin/partners/${id}` : "/admin/partners"} className="inline-flex items-center gap-2 text-[12px] text-inkSoft hover:text-toba mb-3">
          <ArrowLeft className="w-4 h-4" /> {copy.title}
        </Link>
        <div className="eyebrow">Admin</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">{editing ? copy.editTitle : copy.newTitle}</h1>
        <p className="text-[13px] text-inkSoft mt-2">{copy.formSubtitle}</p>
      </header>
      <PartnerForm
        partner={detailQuery.data}
        destinations={destinationsQuery.data || []}
        destinationsLoading={destinationsQuery.isLoading}
        onSubmit={(values) => saveMutation.mutate(values)}
        onCancel={() => navigate(editing ? `/admin/partners/${id}` : "/admin/partners")}
        saving={saveMutation.isPending}
      />
    </div>
  );
}
