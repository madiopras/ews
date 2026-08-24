import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext.jsx";

export default function SearchInput({ value = "", onChange, placeholder, debounceMs = 350, className = "", autoFocus = false }) {
  const { t } = useLang();
  const copy = t.admin.dataTable;
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => setLocalValue(value), [value]);

  useEffect(() => {
    if (localValue === value) return undefined;
    const timer = window.setTimeout(() => onChange(localValue.trim()), debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, localValue, onChange, value]);

  const submitNow = () => onChange(localValue.trim());
  const clear = () => {
    setLocalValue("");
    onChange("");
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkSoft pointer-events-none" />
      <input
        type="search"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitNow();
          }
        }}
        placeholder={placeholder || copy.searchPlaceholder}
        aria-label={placeholder || copy.searchPlaceholder}
        className="input-flat pl-9 pr-11"
        autoFocus={autoFocus}
      />
      {localValue && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-md flex items-center justify-center text-inkSoft hover:text-ink hover:bg-line/40"
          aria-label={copy.clearSearch}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
