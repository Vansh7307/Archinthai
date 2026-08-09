import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Official Google and Microsoft logos as inline SVGs.
 */
export const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
);

export const MicrosoftIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
    <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
    <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
    <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
  </svg>
);

/**
 * "OR" divider.
 */
export function OrDivider({ text = "or" }) {
  return (
    <div className="my-5 flex items-center gap-3" role="separator" aria-label={text}>
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{text}</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

/**
 * Google + Microsoft social login buttons.
 */
export default function SocialButtons({ onGoogle, onMicrosoft, loadingProvider }) {
  const busy = loadingProvider !== null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="auth-btn-social"
          onClick={onGoogle}
          disabled={busy}
          aria-label="Continue with Google"
        >
          {loadingProvider === "google" ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </button>
        <button
          type="button"
          className="auth-btn-social"
          onClick={onMicrosoft}
          disabled={busy}
          aria-label="Continue with Microsoft"
        >
          {loadingProvider === "microsoft" ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <MicrosoftIcon />
          )}
          Continue with Microsoft
        </button>
      </div>
    </div>
  );
}
