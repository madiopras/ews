import React from "react";

const VARIANTS = {
  success: "bg-green-50 text-green-700 border-green-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  neutral: "bg-line/30 text-inkSoft border-line",
};

export default function StatusBadge({ children, variant = "neutral", dot = true, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 min-h-[26px] px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${VARIANTS[variant] || VARIANTS.neutral} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
