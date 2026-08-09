import React, { useMemo } from "react";

/**
 * Password strength meter. Computes a 0-4 score with a label + color.
 */
export default function PasswordStrengthMeter({ password }) {
  const score = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);

  const config = [
    { label: "Too weak", color: "bg-rose-500", text: "text-rose-500" },
    { label: "Weak", color: "bg-orange-500", text: "text-orange-500" },
    { label: "Fair", color: "bg-amber-500", text: "text-amber-500" },
    { label: "Good", color: "bg-lime-500", text: "text-lime-600" },
    { label: "Strong", color: "bg-emerald-500", text: "text-emerald-600" }
  ];

  if (!password) return null;

  const c = config[score];
  return (
    <div className="mt-2">
      <div className="flex h-1.5 gap-1.5" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-label="Password strength">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-full flex-1 rounded-full transition-all duration-300 ${i < score ? c.color : "bg-slate-200"}`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs font-medium ${c.text}`}>{c.label}</p>
    </div>
  );
}
