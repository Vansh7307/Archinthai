import React, { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import LoginForm from "./LoginForm.jsx";
import SignupForm from "./SignupForm.jsx";
import ForgotPassword from "./ForgotPassword.jsx";

/**
 * Centered tabbed authentication card with Login / Sign Up tabs
 * and a Forgot Password view.
 */
export default function AuthCard() {
  const [tab, setTab] = useState("login"); // "login" | "signup"
  const [view, setView] = useState("auth"); // "auth" | "forgot"

  const switchTab = (next) => {
    setView("auth");
    setTab(next);
  };

  return (
    <div className="relative w-full max-w-md">
      {/* Close button */}
      <button
        onClick={() => (window.location.href = "/")}
        className="absolute -top-10 right-0 z-10 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-label="Close and return to the app"
      >
        <X className="h-5 w-5" />
        Close
      </button>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        {/* Logo header */}
        <div className="flex flex-col items-center gap-2 border-b border-slate-100 px-6 pb-5 pt-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/25">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">ArchinthAI</h1>
          <p className="text-sm text-slate-500">Sign in to continue to the studio</p>
        </div>

        {/* Tabs */}
        {view === "auth" ? (
          <>
            <div className="flex border-b border-slate-100 px-6" role="tablist" aria-label="Authentication method">
              <button
                role="tab"
                aria-selected={tab === "login"}
                onClick={() => switchTab("login")}
                className={`auth-tab ${tab === "login" ? "text-indigo-600" : ""}`}
              >
                Login
                <span
                  className={`absolute inset-x-0 bottom-0 mx-auto h-0.5 rounded-full bg-indigo-600 transition-all duration-300 ${
                    tab === "login" ? "w-10 opacity-100" : "w-0 opacity-0"
                  }`}
                />
              </button>
              <button
                role="tab"
                aria-selected={tab === "signup"}
                onClick={() => switchTab("signup")}
                className={`auth-tab ${tab === "signup" ? "text-indigo-600" : ""}`}
              >
                Sign Up
                <span
                  className={`absolute inset-x-0 bottom-0 mx-auto h-0.5 rounded-full bg-indigo-600 transition-all duration-300 ${
                    tab === "signup" ? "w-10 opacity-100" : "w-0 opacity-0"
                  }`}
                />
              </button>
            </div>

            <div className="px-6 py-6" key={tab}>
              {tab === "login" ? (
                <LoginForm onForgotPassword={() => setView("forgot")} />
              ) : (
                <SignupForm />
              )}
            </div>
          </>
        ) : (
          <div className="px-6 py-6">
            <ForgotPassword onBack={() => setView("auth")} />
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center">
          <p className="text-xs text-slate-400">
            Protected by industry-standard authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
