import React, { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, FileCheck2, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { formatError } from "../../../lib/api.js";
import { deletePartnerDocument, downloadPartnerDocument, uploadPartnerDocument } from "./partnerApi.js";

const DOCUMENT_TYPES = ["ktp", "siup", "npwp", "other"];

export default function PartnerDocuments({ partner, onUpdated }) {
  const { t, lang } = useLang();
  const copy = t.admin.partnerAdmin;
  const documentCopy = t.admin.partnerForm.documentTypes;
  const [documentType, setDocumentType] = useState("ktp");
  const [file, setFile] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const inputRef = useRef(null);
  const uploadMutation = useMutation({
    mutationFn: () => uploadPartnerDocument(partner.id, documentType, file),
    onSuccess: (data) => {
      onUpdated(data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(copy.documentUploaded);
    },
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.documentError),
  });
  const deleteMutation = useMutation({
    mutationFn: (document) => deletePartnerDocument(partner.id, document.id),
    onSuccess: (data) => {
      onUpdated(data);
      setDeleteTarget(null);
      toast.success(copy.documentDeleted);
    },
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.documentError),
  });
  const downloadMutation = useMutation({
    mutationFn: (document) => downloadPartnerDocument(partner.id, document),
    onError: (error) => toast.error(error.response?.data?.detail ? formatError(error.response.data.detail) : copy.documentError),
  });

  return (
    <div className="space-y-4" data-testid="partner-documents">
      <section className="card-flat p-4 sm:p-5">
        <h2 className="font-display text-xl">{copy.uploadDocument}</h2>
        <p className="text-[12px] text-inkSoft mt-1 mb-4">{copy.chooseFile}</p>
        <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_auto] gap-2 items-center">
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="input-flat" aria-label={copy.documentType}>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{documentCopy[type]}</option>)}</select>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} className="input-flat text-[12px]" />
          <button type="button" onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending} className="btn-primary disabled:opacity-50">
            {uploadMutation.isPending ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} {copy.uploadDocument}
          </button>
        </div>
      </section>

      <section className="card-flat divide-y divide-line">
        {(partner.verification_documents || []).length === 0 ? <div className="p-8 text-center text-[12px] text-inkSoft">{copy.noDocuments}</div>
          : partner.verification_documents.map((document) => (
            <article key={document.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-toba/10 text-toba flex items-center justify-center shrink-0"><FileCheck2 className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{document.filename}</div>
                <div className="text-[11px] text-inkSoft mt-1">{documentCopy[document.document_type] || document.document_type} · {(document.size / 1024).toFixed(1)} KB · {copy.uploadedAt} {document.uploaded_at ? new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", { dateStyle: "medium" }).format(new Date(document.uploaded_at)) : "-"}</div>
              </div>
              <button type="button" onClick={() => downloadMutation.mutate(document)} disabled={downloadMutation.isPending} className="btn-outline text-[12px]"><Download className="w-4 h-4" /> {copy.download}</button>
              <button type="button" onClick={() => setDeleteTarget(document)} className="btn-outline text-[12px] text-red-700"><Trash2 className="w-4 h-4" /> {t.admin.delete}</button>
            </article>
          ))}
      </section>
      <ConfirmActionDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title={copy.deleteDocumentTitle} description={copy.deleteDocumentDescription} confirmLabel={t.admin.delete} destructive loading={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate(deleteTarget)} />
    </div>
  );
}
