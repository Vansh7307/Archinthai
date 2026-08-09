import React from "react";
import AuthCard from "./components/AuthCard.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";

export default function App() {
  return (
    <ToastProvider>
      {/* Subtle gradient background with glassy orbs */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-violet-600/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" aria-hidden="true" />

        <main className="relative z-10 w-full max-w-md">
          <AuthCard />
        </main>
      </div>
    </ToastProvider>
  );
}
