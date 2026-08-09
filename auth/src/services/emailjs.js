// ============================================================
// EMAIL.JS FALLBACK SERVICE
// ------------------------------------------------------------
// Placeholder fallback for sending custom emails (password reset
// links / OTP notifications) using Email.js.
// Docs: https://www.emailjs.com/docs/
// To enable: install with `npm i @emailjs/browser` and set the
// public key + your service/template ids.
// ============================================================

// import emailjs from "@emailjs/browser";

const EMAILJS_CONFIG = {
  publicKey: "YOUR_PUBLIC_KEY",
  serviceId: "YOUR_SERVICE_ID",
  templateReset: "YOUR_RESET_TEMPLATE_ID",
  templateOtp: "YOUR_OTP_TEMPLATE_ID"
};

/**
 * Send a custom password reset email.
 * @param {string} toEmail
 * @param {string} resetLink
 */
export async function sendResetEmail(toEmail, resetLink) {
  // const payload = {
  //   service_id: EMAILJS_CONFIG.serviceId,
  //   template_id: EMAILJS_CONFIG.templateReset,
  //   user_id: EMAILJS_CONFIG.publicKey,
  //   template_params: { to_email: toEmail, reset_link: resetLink }
  // };
  // const res = await emailjs.send(
  //   EMAILJS_CONFIG.serviceId,
  //   EMAILJS_CONFIG.templateReset,
  //   { to_email: toEmail, reset_link: resetLink },
  //   EMAILJS_CONFIG.publicKey
  // );
  // return res;
  console.log("[EmailJS] sendResetEmail (stub)", { toEmail, resetLink });
  return { status: 200 };
}

/**
 * Send a custom OTP notification email.
 * @param {string} toEmail
 * @param {string} otp
 */
export async function sendOtpEmail(toEmail, otp) {
  // const res = await emailjs.send(
  //   EMAILJS_CONFIG.serviceId,
  //   EMAILJS_CONFIG.templateOtp,
  //   { to_email: toEmail, otp: otp },
  //   EMAILJS_CONFIG.publicKey
  // );
  // return res;
  console.log("[EmailJS] sendOtpEmail (stub)", { toEmail, otp });
  return { status: 200 };
}
