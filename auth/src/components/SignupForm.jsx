import React, { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import PasswordInput from "./PasswordInput.jsx";
import SocialButtons, { OrDivider } from "./SocialButtons.jsx";
import PasswordStrengthMeter from "./PasswordStrengthMeter.jsx";
import { COUNTRIES } from "../data/countries.js";
import { useToast } from "../context/ToastContext.jsx";
import { authService } from "../services/firebase.js";

/**
 * Sign up tab.
 */
export default function SignupForm() {
  const toast = useToast();

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });
  const [countryCode, setCountryCode] = useState("+91");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(null);
  const [errors, setErrors] = useState({});

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required.";
    if (form.fullName.trim().length < 2) e.fullName = "Name must be at least 2 characters.";

    if (!form.username.trim()) e.username = "Username is required.";
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username.trim()))
      e.username = "3-20 chars, letters/numbers/underscore only.";

    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email address.";

    if (!form.phone.trim()) e.phone = "Phone number is required.";
    else if (!/^\d{7,15}$/.test(form.phone.trim())) e.phone = "Enter a valid phone number.";

    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8) e.password = "Must be at least 8 characters.";

    if (form.confirmPassword !== form.password) e.confirmPassword = "Passwords do not match.";

    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      await authService.signup({
        name: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password
      });
      toast.success("Account created successfully!");
      setForm({ fullName: "", username: "", email: "", phone: "", password: "", confirmPassword: "" });
    } catch {
      toast.error("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProvider = async (name) => {
    setProvider(name);
    try {
      await authService.signInWithProvider(name);
      toast.success(`Signed up with ${name === "google" ? "Google" : "Microsoft"}.`);
    } catch {
      toast.error("Provider sign up failed.");
    } finally {
      setProvider(null);
    }
  };

  const field = (key, label, type, placeholder, autoComplete) => (
    <div>
      <label htmlFor={`signup-${key}`} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={`signup-${key}`}
        type={type}
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!errors[key]}
        className={`auth-input ${errors[key] ? "auth-input-error" : ""}`}
      />
      {errors[key] && <p className="mt-1.5 text-xs font-medium text-rose-500">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="animate-fade-up">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("fullName", "Full Name", "text", "John Doe", "name")}
          {field("username", "Username", "text", "johndoe", "username")}
        </div>

        {field("email", "Email Address", "email", "you@example.com", "email")}

        <div>
          <label htmlFor="signup-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Phone Number
          </label>
          <div className="flex">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="auth-select"
              aria-label="Country code"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code + c.name} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <input
              id="signup-phone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="9876543210"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              className={`auth-input rounded-l-none ${errors.phone ? "auth-input-error" : ""}`}
            />
          </div>
          {errors.phone && <p className="mt-1.5 text-xs font-medium text-rose-500">{errors.phone}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <PasswordInput
              id="signup-password"
              label="Password"
              value={form.password}
              onChange={set("password")}
              error={errors.password}
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={form.password} />
          </div>
          <PasswordInput
            id="signup-confirm"
            label="Confirm Password"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <OrDivider />
      <SocialButtons loadingProvider={provider} onGoogle={() => handleProvider("google")} onMicrosoft={() => handleProvider("microsoft")} />
    </div>
  );
}
