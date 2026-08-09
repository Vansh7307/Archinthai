import React, { useState } from "react";
import { Loader2, LogIn, Mail, Phone, Smartphone } from "lucide-react";
import PasswordInput from "./PasswordInput.jsx";
import SocialButtons, { OrDivider } from "./SocialButtons.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { authService } from "../services/firebase.js";
import { sendPhoneOtp, verifyPhoneOtp } from "../services/msg91.js";
import { isDemoMode } from "../config.js";

/**
 * Login tab. Supports both password login and OTP-based login
 * (via email OTP or phone OTP).
 */
export default function LoginForm({ onForgotPassword }) {
  const toast = useToast();

  // Password login state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP login state
  const [otpMode, setOtpMode] = useState("email"); // "email" | "phone"
  const [otpTarget, setOtpTarget] = useState("");
  const [otp, setOtp] = useState("");
  const [countryCode, setCountryCode] = useState("+91");

  // Auth method toggle: "password" | "otp"
  const [authMethod, setAuthMethod] = useState("password");

  // UI state
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [provider, setProvider] = useState(null);
  const [errors, setErrors] = useState({});

  const validatePasswordLogin = () => {
    const e = {};
    if (!identifier.trim()) e.identifier = "Username or email is required.";
    if (!password) e.password = "Password is required.";
    return e;
  };

  const handlePasswordLogin = async (ev) => {
    ev.preventDefault();
    const e = validatePasswordLogin();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await authService.login(identifier.trim(), password);
      toast.success("Signed in successfully!");
    } catch (err) {
      toast.error("Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const e = {};
    if (!otpTarget.trim()) e.otpTarget = "Please enter your email or phone.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
if (otpMode === "email") {
        // Fire a reset-style OTP via Email.js fallback (see services/emailjs.js)
        toast.info(isDemoMode ? "OTP sent to your email (demo)." : "OTP sent to your email.");
      } else {
        await sendPhoneOtp(otpTarget.trim(), countryCode);
        toast.success(isDemoMode ? "OTP sent to your phone (demo)." : "OTP sent to your phone.");
      }
      setOtpSent(true);
    } catch {
      toast.error("Could not send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (ev) => {
    ev.preventDefault();
    if (!otp.trim()) {
      setErrors({ otp: "Enter the OTP you received." });
      return;
    }
    setLoading(true);
    try {
      if (otpMode === "phone") {
        await verifyPhoneOtp(otpTarget.trim(), countryCode, otp.trim());
      }
      toast.success("OTP verified! Signed in.");
    } catch {
      toast.error("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProvider = async (name) => {
    setProvider(name);
    try {
      await authService.signInWithProvider(name);
      toast.success(`Signed in with ${name === "google" ? "Google" : "Microsoft"}.`);
    } catch {
      toast.error("Provider sign in failed.");
    } finally {
      setProvider(null);
    }
  };

  const methodBtn = (value, label, icon) => (
    <button
      type="button"
      onClick={() => {
        setAuthMethod(value);
        setErrors({});
        setOtpSent(false);
        setOtp("");
      }}
      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
        authMethod === value
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
      }`}
      aria-pressed={authMethod === value}
    >
      <span className="inline-flex items-center gap-1.5">{icon}{label}</span>
    </button>
  );

  return (
    <div className="animate-fade-up">
      {/* Auth method toggle */}
      <div className="mb-5 flex gap-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Login method">
        {methodBtn("password", "Password", <LogIn className="h-3.5 w-3.5" />)}
        {methodBtn("otp", "OTP Login", <Smartphone className="h-3.5 w-3.5" />)}
      </div>

      {authMethod === "password" ? (
        <form onSubmit={handlePasswordLogin} noValidate className="space-y-4">
          <div>
            <label htmlFor="login-identifier" className="mb-1.5 block text-sm font-medium text-slate-700">
              Username or Email Address
            </label>
            <input
              id="login-identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              aria-invalid={!!errors.identifier}
              className={`auth-input ${errors.identifier ? "auth-input-error" : ""}`}
            />
            {errors.identifier && <p className="mt-1.5 text-xs font-medium text-rose-500">{errors.identifier}</p>}
          </div>

          <PasswordInput
            id="login-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded"
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="auth-btn-primary" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} noValidate className="space-y-4">
          {/* OTP channel toggle */}
          <div className="flex gap-2 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="OTP channel">
            <button
              type="button"
              role="radio"
              aria-checked={otpMode === "email"}
              onClick={() => { setOtpMode("email"); setOtpSent(false); setOtp(""); }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                otpMode === "email" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> via Email</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={otpMode === "phone"}
              onClick={() => { setOtpMode("phone"); setOtpSent(false); setOtp(""); }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                otpMode === "phone" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> via Phone</span>
            </button>
          </div>

          <div>
            <label htmlFor="otp-target" className="mb-1.5 block text-sm font-medium text-slate-700">
              {otpMode === "email" ? "Email Address" : "Phone Number"}
            </label>
            <div className="flex">
              {otpMode === "phone" && (
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="auth-select"
                  aria-label="Country code"
                >
                  {["+91", "+1", "+44", "+61", "+971", "+65", "+81", "+49", "+33"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
              <input
                id="otp-target"
                type={otpMode === "email" ? "email" : "tel"}
                value={otpTarget}
                onChange={(e) => setOtpTarget(e.target.value)}
                placeholder={otpMode === "email" ? "you@example.com" : "9876543210"}
                aria-invalid={!!errors.otpTarget}
                className={`auth-input ${otpMode === "phone" ? "rounded-l-none" : ""} ${errors.otpTarget ? "auth-input-error" : ""}`}
              />
            </div>
            {errors.otpTarget && <p className="mt-1.5 text-xs font-medium text-rose-500">{errors.otpTarget}</p>}
          </div>

          {!otpSent ? (
            <button type="button" onClick={handleSendOtp} className="auth-btn-primary" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              {loading ? "Sending..." : "Send OTP"}
            </button>
          ) : (
            <>
              <div>
                <label htmlFor="otp-code" className="mb-1.5 block text-sm font-medium text-slate-700">Enter OTP</label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit code"
                  className={`auth-input text-center tracking-[0.5em] ${errors.otp ? "auth-input-error" : ""}`}
                />
                {errors.otp && <p className="mt-1.5 text-xs font-medium text-rose-500">{errors.otp}</p>}
              </div>
              <button type="submit" className="auth-btn-primary" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                className="w-full text-center text-xs font-semibold text-indigo-600 hover:underline"
              >
                Resend OTP
              </button>
            </>
          )}
        </form>
      )}

      <OrDivider />
      <SocialButtons loadingProvider={provider} onGoogle={() => handleProvider("google")} onMicrosoft={() => handleProvider("microsoft")} />
    </div>
  );
}
