import React from "react";
import { LoaderCircle, Save } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";

export default function FormActions({ onCancel, saving = false, disabled = false, saveLabel, cancelLabel, sticky = true }) {
  const { t } = useLang();
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-line pt-4 ${sticky ? "sticky bottom-0 bg-surface/95 backdrop-blur py-3 z-10" : ""}`}>
      <button type="button" onClick={onCancel} disabled={saving} className="btn-outline">{cancelLabel || t.admin.cancel}</button>
      <button type="submit" disabled={saving || disabled} className="btn-primary">
        {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saveLabel || t.admin.save}
      </button>
    </div>
  );
}
