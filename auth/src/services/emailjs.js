// ============================================================
// EMAIL.JS EMAIL OTP / RESET-LINK SERVICE
// ------------------------------------------------------------
// Real wrapper around EmailJS for sending custom emails (password
// reset links / one-time codes). Reads keys from the environment
// via config.js. If EmailJS is not configured, all calls fall back
// to an internal Mock/Demo Mode so the UI never crashes with a
// white screen.
//
// Docs: https://www.emailjs.com/docs/
// To enable: set VITE_EMAILJS_PUBLIC_KEY, VITE_EMAILJS_SERVICE_ID,
// VITE_EMAILJS_RESET_TEMPLATE_ID, VITE_EMAILJS_OTP_TEMPLATE_ID (see
// config.js / auth/.env.example). EmailJS's public key is designed
// to be used client-side, unlike MSG91's authkey.
//
// ARCHITECTURE NOTE: EmailJS only delivers mail, it doesn't verify
// codes for you. So this module generates a random 6-digit code,
// remembers it (with a short expiry) in sessionStorage, emails it
// via your EmailJS template, and verifies the user's input against
// that stored value. This is a reasonable zero-backend pattern for
// a static site, but note that a determined attacker with devtools
// access to the same browser session could read the stored code -
// for stronger guarantees, verify server-side instead once you have
// a backend.
// ============================================================

import emailjs from "@emailjs/browser";
import { isEmailjsConfigured, emailjs as emailjsConfig } from "../config.js";

const emailjsReady = (() => {
  try {
    return isEmailjsConfigured();
  } catch {
    return false;
  }
})();

const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms));
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const storageKey = (email) => `archinthai:emailOtp:${email.trim().toLowerCase()}`;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * EmailJS rejects with a plain {status, text} object, not an Error
 * instance - so `err.message` is normally undefined and callers
 * silently fall back to a generic message, hiding the real reason
 * (bad template ID, domain not allowed, missing template variable,
 * etc). This normalizes it into a real Error with that reason
 * attached, and logs the raw object so it's visible in devtools.
 */
function normalizeEmailjsError(err) {
  console.error("[EmailJS] send failed:", err);
  const status = err && err.status;
  const text = (err && err.text) || (err && err.message) || "";
  const reason = text ? `${text}${status ? ` (${status})` : ""}` : "Unknown EmailJS error - check the browser console for details.";
  return new Error(`Couldn't send the email: ${reason}`);
}

/** Send a password reset email with a direct link. */
export async function sendResetEmail(toEmail, resetLink) {
  if (emailjsReady) {
    try {
      const res = await emailjs.send(
        emailjsConfig.serviceId.value,
        emailjsConfig.templateReset.value,
        { to_email: toEmail, reset_link: resetLink },
        emailjsConfig.publicKey.value
      );
      return { ...res, demo: false };
    } catch (err) {
      throw normalizeEmailjsError(err);
    }
  }
  await delay();
  console.log("[EmailJS][Demo] sendResetEmail", { toEmail, resetLink });
  return { status: 200, demo: true };
}

/**
 * Generate a fresh one-time code, remember it locally with a short
 * expiry, and email it to the user. Returns { demo } — never
 * returns the code itself to the caller (it lives only in
 * sessionStorage + the outbound email).
 */
export async function sendAndTrackOtpEmail(toEmail) {
  const otp = generateOtp();
  const record = { otp, expiresAt: Date.now() + OTP_TTL_MS };

  if (emailjsReady) {
    try {
      await emailjs.send(
        emailjsConfig.serviceId.value,
        emailjsConfig.templateOtp.value,
        { to_email: toEmail, otp },
        emailjsConfig.publicKey.value
      );
    } catch (err) {
      throw normalizeEmailjsError(err);
    }
    window.sessionStorage.setItem(storageKey(toEmail), JSON.stringify(record));
    return { demo: false };
  }

  await delay();
  console.log("[EmailJS][Demo] sendAndTrackOtpEmail", { toEmail, otp });
  window.sessionStorage.setItem(storageKey(toEmail), JSON.stringify(record));
  return { demo: true, devOtp: otp }; // surfaced only in demo mode, for local testing
}

/** Verify a code the user typed in against the locally-tracked one. */
export function verifyTrackedOtpEmail(toEmail, code) {
  const raw = window.sessionStorage.getItem(storageKey(toEmail));
  if (!raw) throw new Error("That code has expired. Please request a new one.");
  const { otp, expiresAt } = JSON.parse(raw);
  if (Date.now() > expiresAt) {
    window.sessionStorage.removeItem(storageKey(toEmail));
    throw new Error("That code has expired. Please request a new one.");
  }
  if (String(code).trim() !== otp) {
    throw new Error("That code isn't correct. Please try again.");
  }
  window.sessionStorage.removeItem(storageKey(toEmail));
  return true;
}

export const isEnabled = () => emailjsReady;
