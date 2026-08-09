// ============================================================
// MSG91 PHONE OTP SERVICE
// ------------------------------------------------------------
// Placeholder integration for MSG91 OTP flow.
// Docs: https://control.msg91.com/api/v5/otp
// To enable: set your auth key + template id below.
// ============================================================

const MSG91_CONFIG = {
  authKey: "YOUR_MSG91_AUTH_KEY",
  templateId: "YOUR_OTP_TEMPLATE_ID",
  senderId: "YOUR_SENDER_ID"
};

const API_BASE = "https://control.msg91.com/api/v5/otp";

/**
 * Send an OTP to a phone number (with country code).
 * @param {string} phone - e.g. "9876543210"
 * @param {string} countryCode - e.g. "+91"
 */
export async function sendPhoneOtp(phone, countryCode) {
  // const res = await fetch(
  //   `${API_BASE}?template_id=${MSG91_CONFIG.templateId}&mobile=${encodeURIComponent(
  //     countryCode + phone
  //   )}&authkey=${MSG91_CONFIG.authKey}&sender=${MSG91_CONFIG.senderId}`,
  //   { method: "POST" }
  // );
  // const data = await res.json();
  // return data;
  console.log("[MSG91] sendPhoneOtp (stub)", { phone, countryCode });
  return { type: "success", message: "OTP sent (stub)" };
}

/**
 * Verify an OTP.
 * @param {string} phone - e.g. "9876543210"
 * @param {string} countryCode - e.g. "+91"
 * @param {string} otp
 */
export async function verifyPhoneOtp(phone, countryCode, otp) {
  // const res = await fetch(
  //   `${API_BASE}/verify?otp=${otp}&mobile=${encodeURIComponent(countryCode + phone)}&authkey=${MSG91_CONFIG.authKey}`,
  //   { method: "POST" }
  // );
  // const data = await res.json();
  // return data;
  console.log("[MSG91] verifyPhoneOtp (stub)", { phone, countryCode, otp });
  return { type: "success", message: "OTP verified (stub)" };
}
