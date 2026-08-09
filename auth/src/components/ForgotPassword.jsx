import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mail, Phone, Send, Timer } from "lucide-react";
import { useToast } from "../context/ToastContext.jsx";
import { authService } from "../services/firebase.js";
import { sendPhoneOtp } from "../services/msg91.js";
import { sendResetEmail, sendOtpEmail } from "../services/emailjs.js";
import { isDemoMode } from "../config.js";

const RESEND_COOLDOWN = 30; // seconds

/**
 * Forgot password flow with email / phone (OTP) toggle and a
 * resend countdown timer.
 */
export default function ForgotPassword({ onBack }) {
  const toast = useToast();

  const [method, setMethod] = useState("email"); // "email" | "phone"
  const [target, setTarget] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    return () => clearInterval(timer.current);
  }, []);

  const startCountdown = () => {
    setCountdown(RESEND_COOLDOWN);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSend = async (ev) => {
    ev.preventDefault();
    if (!target.trim()) {
      setError(`Please enter your ${method === "email" ? "email address" : "phone number"}.`);
      return;
    }
    if (method === "email" && !/^\S+@\S+\.\S+$/.test(target.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (method === "phone" && !/^\d{7,15}$/.test(target.trim())) {
      setError("Enter a valid phone number.");
      return;
    }

setError("");
    setLoading(true);
    try {
      if (method === "email") {
        const resetLink = `https://archinth-ai.vercel.app/reset?email=${encodeURIComponent(target.trim())}`;
        await authService.sendPasswordReset(target.trim());
        await sendResetEmail(target.trim(), resetLink);
        // Also send a custom OTP email fallback
        await sendOtpEmail(target.trim(), "123456");
        toast.success(isDemoMode ? "Reset link & OTP sent to your email (demo)." : "Reset link & OTP sent to your email.");
      } else {
        await sendPhoneOtp(target.trim(), countryCode);
        toast.success(isDemoMode ? "Password reset OTP sent to your phone (demo)." : "Password reset OTP sent to your phone.");
      }
      setSent(true);
      startCountdown();
    } catch {
      toast.error("Could not send reset code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const methodBtn = (value) => (
    <button
      type="button"
      role="radio"
      aria-checked={method === value}
      onClick={() => {
        setMethod(value);
        setError("");
        setSent(false);
        setTarget("");
      }}
      className={`flex-1 rounded-xl border px-3 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
        method === value
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        {value === "email" ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
        {value === "email" ? "Reset via Email ID" : "Reset via Phone (OTP)"}
      </span>
    </button>
  );

  return (
    <div className="animate-fade-up">
      <div className="mb-5 text-center">
        <h2 className="text-xl font-bold text-slate-900">Forgot Password?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose how you'd like to receive your reset code.
        </p>
      </div>

      <div className="mb-5 flex gap-2" role="radiogroup" aria-label="Reset method">
        {methodBtn("email")}
        {methodBtn("phone")}
      </div>

      <form onSubmit={handleSend} noValidate className="space-y-4">
        <div>
          <label htmlFor="forgot-target" className="mb-1.5 block text-sm font-medium text-slate-700">
            {method === "email" ? "Email Address" : "Phone Number"}
          </label>
          <div className="flex">
            {method === "phone" && (
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
              id="forgot-target"
              type={method === "email" ? "email" : "tel"}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={method === "email" ? "you@example.com" : "9876543210"}
              aria-invalid={!!error}
              className={`auth-input ${method === "phone" ? "rounded-l-none" : ""} ${error ? "auth-input-error" : ""}`}
            />
          </div>
          {error && <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p>}
        </div>

        <button type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? "Sending..." : sent ? "Resend Code / OTP" : "Send Reset Code / OTP"}
        </button>

        {sent && countdown > 0 && (
          <div className="flex animate-fade-in items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600">
            <Timer className="h-4 w-4 text-indigo-500" />
            Resend available in {countdown}s
          </div>
        )}
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Login
      </button>
    </div>
  );
}
