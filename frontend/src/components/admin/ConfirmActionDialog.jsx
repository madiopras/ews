import React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";

export default function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading = false,
  destructive = false,
  children,
  content,
}) {
  const { t } = useLang();
  const copy = t.admin.dataTable;

  return (
    <AlertDialog.Root open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      {children && <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 sm:p-6 shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${destructive ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <AlertDialog.Title className="font-display text-xl text-ink mt-4">{title || copy.confirmTitle}</AlertDialog.Title>
          <AlertDialog.Description className="text-[13px] leading-relaxed text-inkSoft mt-2">
            {description || copy.confirmDescription}
          </AlertDialog.Description>
          {content && <div className="mt-4">{content}</div>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialog.Cancel asChild>
              <button type="button" disabled={loading} className="btn-outline">{cancelLabel || copy.cancel}</button>
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={destructive ? "btn bg-red-700 text-white hover:bg-red-800" : "btn-dark"}
            >
              {loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
              {confirmLabel || copy.confirm}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
