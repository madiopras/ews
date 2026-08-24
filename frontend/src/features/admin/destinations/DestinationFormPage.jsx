import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { formatError } from "../../../lib/api.js";
import DestinationForm from "./DestinationForm.jsx";
import { createDestination, getAdminDestination, updateDestination } from "./destinationApi.js";
import { destinationToPayload } from "./destinationSchema.js";

export default function DestinationFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLang();
  const copy = t.admin.destinationAdmin;
  const detailQuery = useQuery({
    queryKey: ["admin", "destinations", "detail", id],
    queryFn: ({ signal }) => getAdminDestination(id, signal),
    enabled: editing,
  });
  const saveMutation = useMutation({
    mutationFn: (values) => editing
      ? updateDestination(id, destinationToPayload(values))
      : createDestination(destinationToPayload(values)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "destinations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      ]);
      toast.success(copy.saved);
      navigate("/admin/destinations", { replace: true });
    },
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.saveError),
  });

  if (editing && detailQuery.isLoading) {
    return <div className="w-full px-4 sm:px-6 xl:px-8 py-8 text-[13px] text-inkSoft">{copy.loadingDetail}</div>;
  }

  if (editing && detailQuery.isError) {
    return (
      <div className="w-full px-4 sm:px-6 xl:px-8 py-8">
        <div className="card-flat p-6 text-center">
          <p className="text-sm text-red-700">{copy.detailError}</p>
          <Link to="/admin/destinations" className="btn-outline mt-4"><ArrowLeft className="w-4 h-4" /> {t.admin.cancel}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl px-4 sm:px-6 xl:px-8 py-6 pb-16" data-testid="destination-form-page">
      <header className="mb-6">
        <Link to="/admin/destinations" className="inline-flex items-center gap-2 text-[12px] text-inkSoft hover:text-toba mb-3">
          <ArrowLeft className="w-4 h-4" /> {copy.title}
        </Link>
        <div className="eyebrow">Admin</div>
        <h1 className="mt-2 font-display text-[26px] sm:text-4xl leading-tight">{editing ? copy.editTitle : copy.newTitle}</h1>
        <p className="text-[13px] text-inkSoft mt-2">{copy.formSubtitle}</p>
      </header>
      <DestinationForm
        destination={detailQuery.data}
        onSubmit={(values) => saveMutation.mutate(values)}
        onCancel={() => navigate("/admin/destinations")}
        saving={saveMutation.isPending}
      />
    </div>
  );
}
