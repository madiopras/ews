import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function passwordStrength(value) {
  const password = value || "";
  return [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}

export default function PasswordField({ label, value, onChange, hint = "", showStrength = false, testId, autoComplete = "current-password", required = true, showPasswordLabel = "Show password", hidePasswordLabel = "Hide password" }) {
  const [visible, setVisible] = useState(false);
  const score = passwordStrength(value);
  return (
    <label className="block">
      <span className="text-[13px] text-inkSoft">{label}</span>
      <span className="relative mt-2 block">
        <input
          type={visible ? "text" : "password"}
          required={required}
          minLength={showStrength ? 8 : undefined}
          maxLength={128}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="input-flat pr-12"
          data-testid={testId}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-inkSoft hover:text-toba"
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      {showStrength && value && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">{[1, 2, 3, 4].map((level) => <span key={level} className={`h-1 flex-1 rounded ${score >= level ? "bg-toba" : "bg-line"}`} />)}</div>
          <p className="mt-1 text-[11px] text-inkSoft">{hint}</p>
        </div>
      )}
    </label>
  );
}
