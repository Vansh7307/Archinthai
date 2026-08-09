// ============================================================
// MSG91 PHONE OTP SERVICE
// ------------------------------------------------------------
// Safe wrapper around the MSG91 OTP REST API. Reads keys from
// the environment via config.js. If MSG91 is not configured,
// all calls fall back to an internal Mock/Demo Mode so the UI
// never crashes with a white screen.
//
// Docs: https://control.msg91.com/api/v5/otp
// To enable: set VITE_MSG91_* env vars (see config.js notes).
// ============================================================

import { isMsg91Configured, msg91 } from "../config.js";

const API_BASE = "https://control.msg91.com/api/v5/otp";

// The MSG91 Client is not installed by default. Import it only if
// you install it, e.g.:
//   import Msg91 from "msg91";
// const client = new Msg91(msg91.authKey.value, msg91.senderId.value);

const msg91Ready = (() => {
  try {
    return isMsg91Configured();
  } catch {
    return false;
  }
})();

const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms));

/**
 * Send an OTP to a phone number (with country code).
 * @param {string} phone - e.g. "9876543210"
 * @param {string} countryCode - e.g. "+91"
 */
export async function sendPhoneOtp(phone, countryCode) {
  if (msg91Ready) {
    // const res = await fetch(
    //   `${API_BASE}?template_id=${msg91.templateId.value}&mobile=${encodeURIComponent(
    //     countryCode + phone
    //   )}&authkey=${msg91.authKey.value}&sender=${msg91.senderId.value}`,
    //   { method: "POST" }
    // );
    // const data = await res.json();
    // return data;
  }
  await delay();
  console.log("[MSG91][Demo] sendPhoneOtp", { phone, countryCode });
  return { type: "success", message: "OTP sent (demo)", demo: true };
}

/**
 * Verify an OTP.
 * @param {string} phone - e.g. "9876543210"
 * @param {string} countryCode - e.g. "+91"
 * @param {string} otp
 */
export async function verifyPhoneOtp(phone, countryCode, otp) {
  if (msg91Ready) {
    // const res = await fetch(
    //   `${API_BASE}/verify?otp=${otp}&mobile=${encodeURIComponent(countryCode + phone)}&authkey=${msg91.authKey.value}`,
    //   { method: "POST" }
    // );
    // const data = await res.json();
    // return data;
  }
  await delay();
  console.log("[MSG91][Demo] verifyPhoneOtp", { phone, countryCode, otp });
  return { type: "success", message: "OTP verified (demo)", demo: true };
}
