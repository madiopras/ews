import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";

export default function AdminDrawer({ open, onOpenChange, title, description, children, footer, loading = false }) {
  const { t } = useLang();
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[81] w-full sm:max-w-lg border-l border-line bg-surface shadow-2xl outline-none flex flex-col data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <header className="px-5 sm:px-6 py-5 border-b border-line pr-16">
            <Dialog.Title className="font-display text-2xl text-ink">{title}</Dialog.Title>
            {description && <Dialog.Description className="text-[12px] text-inkSoft mt-1.5 leading-relaxed">{description}</Dialog.Description>}
          </header>
          <Dialog.Close className="absolute right-4 top-4 w-11 h-11 rounded-lg flex items-center justify-center text-inkSoft hover:text-ink hover:bg-line/40" aria-label={t.admin.dataTable.closeFilters} disabled={loading}>
            <X className="w-5 h-5" />
          </Dialog.Close>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
          {footer && <footer className="px-5 sm:px-6 py-4 border-t border-line bg-surface">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
