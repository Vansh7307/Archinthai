import React, { useState, useEffect } from "react";
import { authService } from "./services/firebase.js";
import * as msg91Service from "./services/msg91.js";
import * as emailjsService from "./services/emailjs.js";
import { isDemoMode } from "./config.js";

/* ============================================================
   AuthApp — real Firebase-backed auth (email/password, Google,
   Microsoft, phone OTP), with a crash-proof demo fallback.
   ------------------------------------------------------------
   • Falls back to a clearly-labelled Demo Mode automatically if
     no Firebase project is configured (see auth/.env.example),
     so the UI never crashes with a white screen.
   • On any successful sign-in (password, Google, Microsoft,
     phone OTP, or email link) the user is redirected to the main
     ArchinthAI dashboard at "/".
   ============================================================ */

const DASHBOARD_URL = "/";

/* ---------------- Inline SVG icon components ---------------- */
const Icon = {
  Eye: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Mail: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Lock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Phone: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.6 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  User: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Google: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.86 11.86 0 0 0 0 12c0 1.92.46 3.74 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  ),
  Microsoft: (p) => (
    <svg viewBox="0 0 23 23" width="18" height="18" {...p}>
      <rect fill="#F25022" width="11" height="11" rx="1" />
      <rect fill="#7FBA00" x="12" width="11" height="11" rx="1" />
      <rect fill="#00A4EF" y="12" width="11" height="11" rx="1" />
      <rect fill="#FFB900" x="12" y="12" width="11" height="11" rx="1" />
    </svg>
  ),
  Alert: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  Spinner: (p) => (
    <svg viewBox="0 0 24 24" fill="none" className="animate-spin" {...p}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Timer: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 2h6" />
    </svg>
  )
};

/* ---------------- Toast system (self-contained) ------------- */
function useToasts() {
  const [toasts, setToasts] = useState([]);

  const push = (type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };

  const toast = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m)
  };

  const ToastRegion = (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur ${
            t.type === "success"
              ? "border-archinth-success/30 bg-archinth-success"
              : t.type === "error"
              ? "border-archinth-danger/30 bg-archinth-danger"
              : "border-archinth-secondary/40 bg-archinth-secondary"
          }`}
        >
          {t.type === "success" ? (
            <Icon.Check className="h-5 w-5 shrink-0" />
          ) : t.type === "error" ? (
            <Icon.Alert className="h-5 w-5 shrink-0" />
          ) : (
            <Icon.Mail className="h-5 w-5 shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );

  return { toast, ToastRegion };
}

/* ---------------- Small shared UI helpers ---------------- */
const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-archinth-text placeholder-archinth-muted outline-none transition focus:border-archinth-primary focus:ring-2 focus:ring-archinth-primary/20";

const btnPrimary =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-archinth-primary to-archinth-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-archinth-primary/25 transition hover:from-archinth-primary hover:to-archinth-secondary hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-archinth-primary/40 disabled:opacity-60 disabled:cursor-not-allowed";

const countryCodes = ["+91", "+1", "+44", "+61", "+971", "+65", "+81", "+49", "+33"];

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function AuthApp() {
  const { toast, ToastRegion } = useToasts();

  const [tab, setTab] = useState("login"); // "login" | "signup"
  const [view, setView] = useState("auth"); // "auth" | "forgot"

  // Shared form state
  const [login, setLogin] = useState({ identifier: "", password: "", showPassword: false });
  const [signup, setSignup] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    countryCode: "+91",
    password: "",
    confirmPassword: "",
    showPassword: false
  });

  // OTP / forgot state
  const [authMethod, setAuthMethod] = useState("password"); // "password" | "otp"
  const [otpMode, setOtpMode] = useState("email"); // "email" | "phone"
  const [otpTarget, setOtpTarget] = useState("");
  const [otpCountry, setOtpCountry] = useState("+91");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [forgotMethod, setForgotMethod] = useState("email");
  const [forgotTarget, setForgotTarget] = useState("");
  const [forgotCountry, setForgotCountry] = useState("+91");

  // UI state
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(null);
  const [errors, setErrors] = useState({});
  const [countdown, setCountdown] = useState(0);

  // Whether a phone/email OTP has actually been sent this session
  // (MSG91/EmailJS don't hand back an SDK confirmation object like
  // Firebase phone-auth does - the OTP itself is verified server-
  // side (MSG91) or against a short-lived local record (EmailJS)).
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [forgotOtpSent, setForgotOtpSent] = useState(false);

  const goToDashboard = () => {
    setTimeout(() => { window.location.href = DASHBOARD_URL; }, 900);
  };

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  /* ------- Real auth handlers -------
     Google/Microsoft + email/password + password reset -> Firebase.
     Phone OTP -> MSG91. Email OTP -> EmailJS. Microsoft gracefully
     falls back to the OTP tab if it isn't configured for this
     domain yet. */

  const handleLogin = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!login.identifier.trim()) errs.identifier = "Username or email is required.";
    if (!login.password) errs.password = "Password is required.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const { demo } = await authService.login(login.identifier.trim(), login.password);
      toast.success(demo ? "Signed in (Demo Mode - configure Firebase for real accounts)." : "Signed in successfully!");
      goToDashboard();
    } catch (err) {
      toast.error(err.message || "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!signup.fullName.trim()) errs.fullName = "Full name is required.";
    if (!signup.username.trim()) errs.username = "Username is required.";
    if (!/^\S+@\S+\.\S+$/.test(signup.email.trim())) errs.email = "Enter a valid email address.";
    if (!/^\d{7,15}$/.test(signup.phone.trim())) errs.phone = "Enter a valid phone number.";
    if (signup.password.length < 8) errs.password = "Must be at least 8 characters.";
    if (signup.confirmPassword !== signup.password) errs.confirmPassword = "Passwords do not match.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      const { demo } = await authService.signup({
        name: signup.fullName.trim(),
        email: signup.email.trim(),
        password: signup.password
      });
      toast.success(demo ? "Account created (Demo Mode - configure Firebase for real accounts)." : "Account created successfully!");
      setSignup({ fullName: "", username: "", email: "", phone: "", countryCode: "+91", password: "", confirmPassword: "", showPassword: false });
      goToDashboard();
    } catch (err) {
      toast.error(err.message || "Could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!otpTarget.trim()) {
      setErrors({ otpTarget: "Please enter your email or phone." });
      return;
    }
    setLoading(true);
    try {
      if (otpMode === "phone") {
        const { demo } = await msg91Service.sendPhoneOtp(otpTarget.trim(), otpCountry);
        toast.success(demo ? "OTP sent (Demo Mode - enter any 6 digits)." : "OTP sent to your phone.");
      } else {
        const { demo, devOtp } = await emailjsService.sendAndTrackOtpEmail(otpTarget.trim());
        toast.success(demo ? `OTP sent (Demo Mode - code is ${devOtp}).` : "OTP sent to your email.");
      }
      setOtpSent(true);
      setCountdown(30);
    } catch (err) {
      toast.error(err.message || "Couldn't send the code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrors({ otp: "Enter the OTP you received." });
      return;
    }
    setLoading(true);
    try {
      if (otpMode === "phone") {
        const { demo } = await msg91Service.verifyPhoneOtp(otpTarget.trim(), otpCountry, otpCode.trim());
        toast.success(demo ? "Signed in (Demo Mode)." : "OTP verified! Signed in.");
      } else {
        emailjsService.verifyTrackedOtpEmail(otpTarget.trim(), otpCode.trim());
        toast.success("OTP verified! Signed in.");
      }
      goToDashboard();
    } catch (err) {
      toast.error(err.message || "That code isn't correct. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotTarget.trim()) {
      setErrors({ forgotTarget: "Please enter your email or phone." });
      return;
    }
    setLoading(true);
    try {
      if (forgotMethod === "email") {
        const { demo } = await authService.sendPasswordReset(forgotTarget.trim());
        toast.success(demo ? "Reset link sent (Demo Mode)." : "Reset link sent to your email.");
        setCountdown(30);
      } else {
        const { demo } = await msg91Service.sendPhoneOtp(forgotTarget.trim(), forgotCountry);
        toast.success(demo ? "OTP sent (Demo Mode - enter any 6 digits)." : "OTP sent to your phone. Enter it below to verify and sign in.");
        setForgotOtpSent(true);
        setCountdown(30);
      }
    } catch (err) {
      toast.error(err.message || "Couldn't send the reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPhoneVerify = async (code) => {
    if (!code.trim()) {
      setErrors({ forgotOtp: "Enter the OTP you received." });
      return;
    }
    setLoading(true);
    try {
      const { demo } = await msg91Service.verifyPhoneOtp(forgotTarget.trim(), forgotCountry, code.trim());
      toast.success(demo ? "Verified (Demo Mode). Signed in." : "Phone verified! Signed in.");
      goToDashboard();
    } catch (err) {
      toast.error(err.message || "That code isn't correct. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProvider = async (name) => {
    setProvider(name);
    try {
      const { demo } = await authService.signInWithProvider(name);
      toast.success(demo
        ? `Signed in with ${name === "google" ? "Google" : "Microsoft"} (Demo Mode - configure Firebase for real accounts).`
        : `Signed in with ${name === "google" ? "Google" : "Microsoft"}!`);
      goToDashboard();
    } catch (err) {
      if (err.fallbackToOtp) {
        // No verified custom domain / app registration for this
        // provider yet - fall back to OTP instead of a dead end.
        toast.info(`${name === "google" ? "Google" : "Microsoft"} sign-in isn't set up for this domain yet - use a one-time code instead.`);
        setTab("login");
        setAuthMethod("otp");
        setOtpMode("email");
        setOtpSent(false);
        setOtpCode("");
      } else if (!err.cancelled) {
        toast.error(err.message || `${name === "google" ? "Google" : "Microsoft"} sign-in failed. Please try again.`);
      }
    } finally {
      setProvider(null);
    }
  };

  /* ---------------- Render helpers ---------------- */
  const renderField = (key, label, type, value, onChange, placeholder, autoComplete) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-archinth-text">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${inputCls} ${errors[key] ? "border-archinth-danger focus:border-archinth-danger focus:ring-archinth-danger/20" : ""}`}
      />
      {errors[key] && <p className="mt-1.5 text-xs font-medium text-archinth-danger">{errors[key]}</p>}
    </div>
  );

  const methodBtn = (value, label, icon) => (
    <button
      type="button"
      onClick={() => {
        setAuthMethod(value);
        setErrors({});
        setOtpSent(false);
        setOtpCode("");
      }}
      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-archinth-primary/40 ${
        authMethod === value
          ? "border-archinth-primary bg-archinth-primary/10 text-archinth-primary"
          : "border-stone-200 text-archinth-muted hover:border-stone-300 hover:bg-stone-50"
      }`}
    >
      <span className="inline-flex items-center justify-center gap-1.5">{icon}{label}</span>
    </button>
  );

  const forgotToggle = (value, label, icon) => (
    <button
      type="button"
      onClick={() => {
        setForgotMethod(value);
        setErrors({});
        setForgotTarget("");
        setForgotOtpSent(false);
        setForgotOtpCode("");
        setCountdown(0);
      }}
      className={`flex-1 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
        forgotMethod === value
          ? "border-archinth-primary bg-archinth-primary/10 text-archinth-primary"
          : "border-stone-200 text-archinth-muted hover:border-stone-300 hover:bg-stone-50"
      }`}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {icon}
        {label}
      </span>
    </button>
  );

  return (
    <>
      {ToastRegion}

      {/* Background */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-archinth-bg via-archinth-bg2 to-archinth-bg px-4 py-12">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-archinth-secondary/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-archinth-primary/25 blur-3xl" aria-hidden="true" />

        <div className="relative w-full max-w-md">
          <div className="overflow-hidden rounded-3xl border border-archinth-border/15 bg-archinth-panel shadow-card">
            {/* Header */}
            <div className="flex flex-col items-center gap-2 border-b border-archinth-border/15 px-6 pb-5 pt-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-archinth-primary to-archinth-secondary shadow-lg shadow-archinth-primary/25">
                <Icon.Shield className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-archinth-text">ArchinthAI</h1>
              <p className="text-sm text-archinth-muted">Sign in to continue to the studio</p>
            </div>

            {/* Demo notice — only shown when nothing is configured yet */}
            {isDemoMode && (
              <div className="flex items-center gap-2 bg-archinth-secondary/15 px-4 py-2.5 text-xs font-medium text-archinth-success">
                <Icon.Alert className="h-4 w-4 shrink-0" />
                Demo Mode — connect Firebase/MSG91/EmailJS (see auth/.env.example) to enable real sign-in.
              </div>
            )}

            {view === "auth" ? (
              <>
                {/* Tabs */}
                <div className="flex border-b border-archinth-border/15 px-6">
                  {["login", "signup"].map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTab(t); setErrors({}); }}
                      className="relative flex-1 py-3 text-sm font-semibold text-archinth-muted transition hover:text-archinth-text"
                    >
                      {t === "login" ? "Login" : "Sign Up"}
                      <span
                        className={`absolute inset-x-0 bottom-0 mx-auto h-0.5 rounded-full bg-archinth-primary transition-all duration-300 ${
                          tab === t ? "w-10 opacity-100" : "w-0 opacity-0"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="px-6 py-6">
                  {tab === "login" ? (
                    /* ============ LOGIN ============ */
                    <div>
                      {/* Password / OTP toggle */}
                      <div className="mb-5 flex gap-2 rounded-xl bg-stone-100 p-1">
                        {methodBtn("password", "Password", <Icon.Lock className="h-3.5 w-3.5" />)}
                        {methodBtn("otp", "OTP Login", <Icon.Phone className="h-3.5 w-3.5" />)}
                      </div>

                      {authMethod === "password" ? (
                        <form onSubmit={handleLogin} noValidate className="space-y-4">
                          {renderField("identifier", "Username or Email Address", "text", login.identifier, (e) => setLogin({ ...login, identifier: e.target.value }), "you@example.com", "username")}

                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-archinth-text">Password</label>
                            <div className="relative">
                              <input
                                type={login.showPassword ? "text" : "password"}
                                value={login.password}
                                onChange={(e) => setLogin({ ...login, password: e.target.value })}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                className={`${inputCls} pr-10 ${errors.password ? "border-archinth-danger" : ""}`}
                              />
                              <button
                                type="button"
                                onClick={() => setLogin({ ...login, showPassword: !login.showPassword })}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-archinth-muted transition hover:text-archinth-muted"
                                aria-label="Toggle password visibility"
                              >
                                {login.showPassword ? <Icon.EyeOff className="h-4 w-4" /> : <Icon.Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {errors.password && <p className="mt-1.5 text-xs font-medium text-archinth-danger">{errors.password}</p>}
                          </div>

                          <div className="flex justify-end">
                            <button type="button" onClick={() => setView("forgot")} className="rounded text-xs font-semibold text-archinth-primary hover:text-archinth-primary hover:underline">
                              Forgot Password?
                            </button>
                          </div>

                          <button type="submit" className={btnPrimary} disabled={loading}>
                            {loading ? <Icon.Spinner className="h-4 w-4" /> : <Icon.Mail className="h-4 w-4" />}
                            {loading ? "Signing in..." : "Sign In"}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleVerifyOTP} noValidate className="space-y-4">
                          {/* OTP channel */}
                          <div className="flex gap-2 rounded-xl bg-stone-100 p-1">
                            {[
                              { v: "email", label: "via Email", icon: <Icon.Mail className="h-3.5 w-3.5" /> },
                              { v: "phone", label: "via Phone", icon: <Icon.Phone className="h-3.5 w-3.5" /> }
                            ].map((o) => (
                              <button key={o.v} type="button" onClick={() => { setOtpMode(o.v); setOtpSent(false); setOtpCode(""); }}
                                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${otpMode === o.v ? "border-archinth-primary bg-archinth-primary/10 text-archinth-primary" : "border-stone-200 text-archinth-muted hover:bg-stone-50"}`}>
                                <span className="inline-flex items-center justify-center gap-1.5">{o.icon}{o.label}</span>
                              </button>
                            ))}
                          </div>

                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-archinth-text">{otpMode === "email" ? "Email Address" : "Phone Number"}</label>
                            <div className="flex">
                              {otpMode === "phone" && (
                                <select value={otpCountry} onChange={(e) => setOtpCountry(e.target.value)} className="rounded-l-xl border border-stone-200 bg-white px-3 text-sm text-archinth-text focus:outline-none">
                                  {countryCodes.map((c) => <option key={c}>{c}</option>)}
                                </select>
                              )}
                              <input
                                type={otpMode === "email" ? "email" : "tel"}
                                value={otpTarget}
                                onChange={(e) => setOtpTarget(e.target.value)}
                                placeholder={otpMode === "email" ? "you@example.com" : "9876543210"}
                                className={`${inputCls} ${otpMode === "phone" ? "rounded-l-none" : ""}`}
                              />
                            </div>
                          </div>

                          {!otpSent ? (
                            <button type="button" onClick={handleSendOTP} className={btnPrimary} disabled={loading}>
                              {loading ? <Icon.Spinner className="h-4 w-4" /> : <Icon.Phone className="h-4 w-4" />}
                              {loading ? "Sending..." : "Send OTP"}
                            </button>
                          ) : (
                            <>
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-archinth-text">Enter OTP</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={otpCode}
                                  onChange={(e) => setOtpCode(e.target.value)}
                                  placeholder="6-digit code"
                                  className={`${inputCls} text-center tracking-[0.5em]`}
                                />
                              </div>
                              <button type="submit" className={btnPrimary} disabled={loading}>
                                {loading ? <Icon.Spinner className="h-4 w-4" /> : <Icon.Check className="h-4 w-4" />}
                                {loading ? "Verifying..." : "Verify & Sign In"}
                              </button>
                              <div className="flex items-center justify-center gap-2 text-xs font-medium text-archinth-muted">
                                {countdown > 0 ? (
                                  <span className="inline-flex items-center gap-1"><Icon.Timer className="h-4 w-4 text-archinth-primary" />Resend in {countdown}s</span>
                                ) : (
                                  <button type="button" onClick={handleSendOTP} className="font-semibold text-archinth-primary hover:underline">Resend OTP</button>
                                )}
                              </div>
                            </>
                          )}
                        </form>
                      )}

                      {/* Social login */}
                      <div className="mt-6">
                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-stone-200" /></div>
                          <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-archinth-muted">OR</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <button type="button" onClick={() => handleProvider("google")} disabled={!!provider}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-semibold text-archinth-text transition hover:bg-stone-50 disabled:opacity-60">
                            {provider === "google" ? <Icon.Spinner className="h-4 w-4" /> : <Icon.Google />} Google
                          </button>
                          <button type="button" onClick={() => handleProvider("microsoft")} disabled={!!provider}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-semibold text-archinth-text transition hover:bg-stone-50 disabled:opacity-60">
                            {provider === "microsoft" ? <Icon.Spinner className="h-4 w-4" /> : <Icon.Microsoft />} Microsoft
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ============ SIGN UP ============ */
                    <form onSubmit={handleSignup} noValidate className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {renderField("fullName", "Full Name", "text", signup.fullName, (e) => setSignup({ ...signup, fullName: e.target.value }), "John Doe", "name")}
                        {renderField("username", "Username", "text", signup.username, (e) => setSignup({ ...signup, username: e.target.value }), "johndoe", "username")}
                      </div>

                      {renderField("email", "Email Address", "email", signup.email, (e) => setSignup({ ...signup, email: e.target.value }), "you@example.com", "email")}

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-archinth-text">Phone Number</label>
                        <div className="flex">
                          <select value={signup.countryCode} onChange={(e) => setSignup({ ...signup, countryCode: e.target.value })} className="rounded-l-xl border border-stone-200 bg-white px-2 text-sm text-archinth-text focus:outline-none">
                            {countryCodes.map((c) => <option key={c}>{c}</option>)}
                          </select>
                          <input
                            type="tel"
                            value={signup.phone}
                            onChange={(e) => setSignup({ ...signup, phone: e.target.value })}
                            placeholder="9876543210"
                            autoComplete="tel"
                            className={`${inputCls} rounded-l-none ${errors.phone ? "border-archinth-danger" : ""}`}
                          />
                        </div>
                        {errors.phone && <p className="mt-1.5 text-xs font-medium text-archinth-danger">{errors.phone}</p>}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-archinth-text">Password</label>
                          <div className="relative">
                            <input
                              type={signup.showPassword ? "text" : "password"}
                              value={signup.password}
                              onChange={(e) => setSignup({ ...signup, password: e.target.value })}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className={`${inputCls} pr-10 ${errors.password ? "border-archinth-danger" : ""}`}
                            />
                            <button type="button" onClick={() => setSignup({ ...signup, showPassword: !signup.showPassword })} className="absolute right-3 top-1/2 -translate-y-1/2 text-archinth-muted" aria-label="Toggle password visibility">
                              {signup.showPassword ? <Icon.EyeOff className="h-4 w-4" /> : <Icon.Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {errors.password && <p className="mt-1.5 text-xs font-medium text-archinth-danger">{errors.password}</p>}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-archinth-text">Confirm Password</label>
                          <input
                            type="password"
                            value={signup.confirmPassword}
                            onChange={(e) => setSignup({ ...signup, confirmPassword: e.target.value })}
                            placeholder="••••••••"
                            autoComplete="new-password"
                            className={`${inputCls} ${errors.confirmPassword ? "border-archinth-danger" : ""}`}
                          />
                          {errors.confirmPassword && <p className="mt-1.5 text-xs font-medium text-archinth-danger">{errors.confirmPassword}</p>}
                        </div>
                      </div>

                      <button type="submit" className={btnPrimary} disabled={loading}>
                        {loading ? <Icon.Spinner className="h-4 w-4" /> : <Icon.User className="h-4 w-4" />}
                        {loading ? "Creating account..." : "Create Account"}
                      </button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              /* ============ FORGOT PASSWORD ============ */
              <div className="px-6 py-6">
                <div className="mb-5 text-center">
                  <h2 className="text-xl font-bold text-archinth-text">Forgot Password?</h2>
                  <p className="mt-1 text-sm text-archinth-muted">Choose how you'd like to receive your reset code.</p>
                </div>

                <div className="mb-5 flex gap-2">
                  {forgotToggle("email", "Reset via Email ID", <Icon.Mail className="h-4 w-4" />)}
                  {forgotToggle("phone", "Reset via Phone (OTP)", <Icon.Phone className="h-4 w-4" />)}
                </div>

                <form onSubmit={handleForgot} noValidate className="space-y-4">
                  {!(forgotMethod === "phone" && forgotOtpSent) && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-archinth-text">{forgotMethod === "email" ? "Email Address" : "Phone Number"}</label>
                      <div className="flex">
                        {forgotMethod === "phone" && (
                          <select value={forgotCountry} onChange={(e) => setForgotCountry(e.target.value)} className="rounded-l-xl border border-stone-200 bg-white px-2 text-sm text-archinth-text focus:outline-none">
                            {countryCodes.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        )}
                        <input
                          type={forgotMethod === "email" ? "email" : "tel"}
                          value={forgotTarget}
                          onChange={(e) => setForgotTarget(e.target.value)}
                          placeholder={forgotMethod === "email" ? "you@example.com" : "9876543210"}
                          className={`${inputCls} ${forgotMethod === "phone" ? "rounded-l-none" : ""}`}
                        />
                      </div>
                    </div>
                  )}

                  {!(forgotMethod === "phone" && forgotOtpSent) ? (
                    <button type="submit" className={btnPrimary} disabled={loading}>
                      {loading ? <Icon.Spinner className="h-4 w-4" /> : <Icon.Mail className="h-4 w-4" />}
                      {loading ? "Sending..." : "Send Reset Code / OTP"}
                    </button>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-archinth-text">Enter OTP</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={forgotOtpCode}
                          onChange={(e) => setForgotOtpCode(e.target.value)}
                          placeholder="6-digit code"
                          className={`${inputCls} text-center tracking-[0.5em]`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleForgotPhoneVerify(forgotOtpCode.trim())}
                        className={btnPrimary}
                        disabled={loading || !forgotOtpCode.trim()}
                      >
                        {loading ? <Icon.Spinner className="h-4 w-4" /> : <Icon.Check className="h-4 w-4" />}
                        {loading ? "Verifying..." : "Verify & Sign In"}
                      </button>
                    </>
                  )}

                  {countdown > 0 && (
                    <div className="flex animate-pulse items-center justify-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-sm font-medium text-archinth-muted">
                      <Icon.Timer className="h-4 w-4 text-archinth-primary" />
                      Resend available in {countdown}s
                    </div>
                  )}
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setView("auth");
                    setForgotOtpSent(false);
                    setForgotOtpCode("");
                    setForgotTarget("");
                    setCountdown(0);
                    setErrors({});
                  }}
                  className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-archinth-muted hover:text-archinth-text"
                >
                  <Icon.Arrow className="h-4 w-4" />
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
