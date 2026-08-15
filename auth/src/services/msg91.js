// ============================================================
// MSG91 PHONE OTP SERVICE
// ------------------------------------------------------------
// Real wrapper around the MSG91 OTP REST API. Reads keys from the
// environment via config.js. If MSG91 is not configured, all calls
// fall back to an internal Mock/Demo Mode so the UI never crashes
// with a white screen.
//
// Docs: https://control.msg91.com/api/v5/otp
// To enable: set VITE_MSG91_AUTH_KEY, VITE_MSG91_TEMPLATE_ID, and
// VITE_MSG91_SENDER_ID (see config.js / auth/.env.example).
//
// SECURITY NOTE: this calls the MSG91 API directly from the
// browser, which means VITE_MSG91_AUTH_KEY ships inside the public
// JS bundle. That's acceptable for a quick zero-backend rollout,
// but MSG91's authkey can also send/spend on your account, so
// before going to real production traffic you should proxy these
// two calls through a small backend endpoint that holds the key
// server-side instead. The request/response shape here is written
// so swapping the fetch target for your own backend later is a
// one-line change.
// ============================================================

import { isMsg91Configured, msg91 } from "../config.js";

const API_BASE = "https://control.msg91.com/api/v5/otp";

const msg91Ready = (() => {
  try {
    return isMsg91Configured();
  } catch {
    return false;
  }
})();

const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms));

/**
 * Send an OTP to a phone number (with country code). MSG91
 * generates and stores the OTP server-side - nothing to remember
 * on the client.
 * @param {string} phone - e.g. "9876543210"
 * @param {string} countryCode - e.g. "+91"
 */
export async function sendPhoneOtp(phone, countryCode) {
  if (msg91Ready) {
    const mobile = `${countryCode}${phone}`.replace("+", "");
    const url = `${API_BASE}?template_id=${encodeURIComponent(msg91.templateId.value)}&mobile=${encodeURIComponent(
      mobile
    )}&authkey=${encodeURIComponent(msg91.authKey.value)}&sender=${encodeURIComponent(msg91.senderId.value || "")}`;
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.type === "error") {
      throw new Error(data.message || "Couldn't send the OTP. Please try again.");
    }
    return { ...data, demo: false };
  }
  await delay();
  console.log("[MSG91][Demo] sendPhoneOtp", { phone, countryCode });
  return { type: "success", message: "OTP sent (Demo Mode - enter any 6 digits)", demo: true };
}

/**
 * Verify an OTP against MSG91's own server-side record for that
 * phone number.
 * @param {string} phone - e.g. "9876543210"
 * @param {string} countryCode - e.g. "+91"
 * @param {string} otp
 */
export async function verifyPhoneOtp(phone, countryCode, otp) {
  if (msg91Ready) {
    const mobile = `${countryCode}${phone}`.replace("+", "");
    const url = `${API_BASE}/verify?otp=${encodeURIComponent(otp)}&mobile=${encodeURIComponent(
      mobile
    )}&authkey=${encodeURIComponent(msg91.authKey.value)}`;
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.type === "error") {
      throw new Error(data.message || "That code isn't correct. Please try again.");
    }
    return { ...data, demo: false };
  }
  await delay();
  console.log("[MSG91][Demo] verifyPhoneOtp", { phone, countryCode, otp });
  if (!otp || otp.trim().length < 4) {
    throw new Error("Enter the code you received.");
  }
  return { type: "success", message: "OTP verified (demo)", demo: true };
}

export const isEnabled = () => msg91Ready;
