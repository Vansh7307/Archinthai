// ============================================================
// EMAIL.JS FALLBACK SERVICE
// ------------------------------------------------------------
// Safe wrapper around Email.js for sending custom emails
// (password reset links / OTP notifications). Reads keys from
// the environment via config.js. If Email.js is not configured,
// all calls fall back to an internal Mock/Demo Mode so the UI
// never crashes with a white screen.
//
// Docs: https://www.emailjs.com/docs/
// To enable: `npm i @emailjs/browser` and set the VITE_EMAILJS_*
// env vars (see config.js notes).
// ============================================================

// import emailjs from "@emailjs/browser";

import { isEmailjsConfigured, emailjs } from "../config.js";

const emailjsReady = (() => {
  try {
    return isEmailjsConfigured();
  } catch {
    return false;
  }
})();

const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a custom password reset email.
 * @param {string} toEmail
 * @param {string} resetLink
 */
export async function sendResetEmail(toEmail, resetLink) {
  if (emailjsReady) {
    // const res = await emailjs.send(
    //   emailjs.serviceId.value,
    //   emailjs.templateReset.value,
    //   { to_email: toEmail, reset_link: resetLink },
    //   emailjs.publicKey.value
    // );
    // return res;
  }
  await delay();
  console.log("[EmailJS][Demo] sendResetEmail", { toEmail, resetLink });
  return { status: 200, demo: true };
}

/**
 * Send a custom OTP notification email.
 * @param {string} toEmail
 * @param {string} otp
 */
export async function sendOtpEmail(toEmail, otp) {
  if (emailjsReady) {
    // const res = await emailjs.send(
    //   emailjs.serviceId.value,
    //   emailjs.templateOtp.value,
    //   { to_email: toEmail, otp: otp },
    //   emailjs.publicKey.value
    // );
    // return res;
  }
  await delay();
  console.log("[EmailJS][Demo] sendOtpEmail", { toEmail, otp });
  return { status: 200, demo: true };
}
