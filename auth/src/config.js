// ============================================================
// SAFE CONFIGURATION MODULE
// ------------------------------------------------------------
// Reads API keys from environment variables (import.meta.env for
// Vite) and safely resolves them. If any required key is missing,
// empty, or still a placeholder string, the app automatically
// falls back to Mock/Demo Mode so the UI never crashes with a
// white screen.
//
// To enable a real service, create a `.env` file in the `auth/`
// folder (or set the vars in your hosting platform) with the
// appropriate values, e.g.:
//
//   VITE_FIREBASE_API_KEY=...
//   VITE_FIREBASE_AUTH_DOMAIN=...
//   VITE_FIREBASE_PROJECT_ID=...
//   VITE_FIREBASE_STORAGE_BUCKET=...
//   VITE_FIREBASE_MESSAGING_SENDER_ID=...
//   VITE_FIREBASE_APP_ID=...
//   VITE_MSG91_AUTH_KEY=...
//   VITE_MSG91_TEMPLATE_ID=...
//   VITE_MSG91_SENDER_ID=...
//   VITE_EMAILJS_PUBLIC_KEY=...
//   VITE_EMAILJS_SERVICE_ID=...
//   VITE_EMAILJS_RESET_TEMPLATE_ID=...
//   VITE_EMAILJS_OTP_TEMPLATE_ID=...
// ============================================================

const PLACEHOLDERS = [
  "YOUR_API_KEY",
  "YOUR_PROJECT_ID",
  "YOUR_FIREBASE_",
  "YOUR_MSG91_",
  "YOUR_OTP_",
  "YOUR_SENDER_ID",
  "YOUR_PUBLIC_KEY",
  "YOUR_SERVICE_ID",
  "YOUR_RESET_",
  "YOUR_",
  "your-",
  "CHANGE_ME",
  "xxxx",
  "---"
];

/**
 * Read a value from the environment safely. Works in both Vite
 * (import.meta.env) and, as a fallback, process.env (Node/build).
 * Never throws.
 * @param {string} key - The env var name WITHOUT the "VITE_" prefix.
 * @returns {string} The value or "" if unavailable.
 */
function readEnv(key) {
  try {
    const fullKey = `VITE_${key}`;
    // Vite exposes env vars via import.meta.env
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[fullKey] !== undefined) {
      return String(import.meta.env[fullKey] ?? "").trim();
    }
    // Fallback to process.env (Node / SSR / build tooling)
    if (typeof process !== "undefined" && process.env && process.env[fullKey] !== undefined) {
      return String(process.env[fullKey] ?? "").trim();
    }
  } catch {
    // ignore - fall through to empty string
  }
  return "";
}

/**
 * Determine whether a raw value counts as "configured" (i.e. not
 * missing, empty, or a placeholder).
 * @param {string} value
 * @returns {boolean}
 */
function isConfiguredValue(value) {
  if (!value || typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  return !PLACEHOLDERS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Safely read a config value and return either the real value or
 * an empty string (representing "not configured").
 * @param {string} key
 * @returns {{ value: string, configured: boolean }}
 */
function safeConfig(key) {
  const value = readEnv(key);
  return { value, configured: isConfiguredValue(value) };
}

// ---- Firebase -------------------------------------------------
const firebase = {
  apiKey: safeConfig("FIREBASE_API_KEY"),
  authDomain: safeConfig("FIREBASE_AUTH_DOMAIN"),
  projectId: safeConfig("FIREBASE_PROJECT_ID"),
  storageBucket: safeConfig("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: safeConfig("FIREBASE_MESSAGING_SENDER_ID"),
  appId: safeConfig("FIREBASE_APP_ID")
};

// ---- MSG91 ----------------------------------------------------
const msg91 = {
  authKey: safeConfig("MSG91_AUTH_KEY"),
  templateId: safeConfig("MSG91_TEMPLATE_ID"),
  senderId: safeConfig("MSG91_SENDER_ID")
};

// ---- Email.js -------------------------------------------------
const emailjs = {
  publicKey: safeConfig("EMAILJS_PUBLIC_KEY"),
  serviceId: safeConfig("EMAILJS_SERVICE_ID"),
  templateReset: safeConfig("EMAILJS_RESET_TEMPLATE_ID"),
  templateOtp: safeConfig("EMAILJS_OTP_TEMPLATE_ID")
};

/**
 * Whether Firebase is sufficiently configured to be enabled.
 * @returns {boolean}
 */
const isFirebaseConfigured = () =>
  firebase.apiKey.configured &&
  firebase.authDomain.configured &&
  firebase.projectId.configured;

/**
 * Whether MSG91 is sufficiently configured to be enabled.
 * @returns {boolean}
 */
const isMsg91Configured = () =>
  msg91.authKey.configured && msg91.templateId.configured;

/**
 * Whether Email.js is sufficiently configured to be enabled.
 * @returns {boolean}
 */
const isEmailjsConfigured = () =>
  emailjs.publicKey.configured && emailjs.serviceId.configured;

/**
 * Global demo-mode flag. If ANY primary auth service is not
 * configured, the whole app runs in Demo Mode so it renders
 * cleanly without throwing.
 */
const isDemoMode = !isFirebaseConfigured();

export {
  readEnv,
  isConfiguredValue,
  isDemoMode,
  isFirebaseConfigured,
  isMsg91Configured,
  isEmailjsConfigured,
  firebase,
  msg91,
  emailjs
};
