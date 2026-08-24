import React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Filter, RotateCcw, X } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";

export default function FilterPopover({ label, activeCount = 0, children, onReset, align = "start" }) {
  const { t } = useLang();
  const copy = t.admin.dataTable;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className={`chip min-h-[40px] px-3 ${activeCount ? "border-toba text-toba font-semibold" : ""}`}>
          <Filter className="w-3.5 h-3.5" />
          {label || copy.filters}
          {activeCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-toba text-cream text-[10px] flex items-center justify-center">{activeCount}</span>}
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={8}
          className="z-[70] w-[min(92vw,320px)] rounded-xl border border-line bg-surface shadow-soft-md p-4 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="font-semibold text-sm">{label || copy.filters}</div>
            <div className="flex items-center gap-1">
              {activeCount > 0 && onReset && (
                <button type="button" onClick={onReset} className="min-h-[36px] px-2 rounded-md text-[11px] text-inkSoft hover:text-toba hover:bg-line/30">
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> {copy.reset}
                </button>
              )}
              <Popover.Close className="w-9 h-9 rounded-md flex items-center justify-center text-inkSoft hover:text-ink hover:bg-line/40" aria-label={copy.closeFilters}>
                <X className="w-4 h-4" />
              </Popover.Close>
            </div>
          </div>
          <div className="space-y-4">{children}</div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
