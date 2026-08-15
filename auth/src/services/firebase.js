// ============================================================
// FIREBASE AUTHENTICATION SERVICE
// ------------------------------------------------------------
// Real wrapper around Firebase Auth for the parts that need a
// managed identity provider: Google OAuth, Microsoft OAuth,
// email/password login & signup, and password-reset email.
//
// Phone OTP and email OTP are handled separately by msg91.js and
// emailjs.js (see those files) - that split lets phone/email OTP
// work with zero Google/Microsoft app registration, which matters
// if you don't yet have a verified custom domain for OAuth.
//
// Google sign-in through Firebase is effectively zero-config:
// Firebase auto-provisions its own OAuth client for Google, and
// localhost/127.0.0.1 are authorized by default - you only need to
// add your real domain under Authentication > Settings > Authorized
// domains once you have one (no Google domain-verification process
// required, unlike a raw Google Cloud OAuth client).
//
// Microsoft sign-in through Firebase is NOT zero-config - it needs
// a real Azure AD (Entra ID) app registration configured in the
// Firebase console. Until that's done, signInWithProvider("microsoft")
// will throw auth/operation-not-allowed; AuthApp.jsx catches that
// and gracefully drops the user into the OTP flow instead, per the
// "domain limitation" fallback requirement.
//
// If Firebase itself isn't configured at all, every call falls
// back to an internal Mock/Demo Mode so the UI never crashes.
// ============================================================

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  updateProfile
} from "firebase/auth";

import { isFirebaseConfigured, firebase } from "../config.js";

let app = null;
let auth = null;
let firebaseEnabled = false;

try {
  firebaseEnabled = isFirebaseConfigured();
  if (firebaseEnabled) {
    app = getApps().length ? getApp() : initializeApp({
      apiKey: firebase.apiKey.value,
      authDomain: firebase.authDomain.value,
      projectId: firebase.projectId.value,
      storageBucket: firebase.storageBucket.value,
      messagingSenderId: firebase.messagingSenderId.value,
      appId: firebase.appId.value
    });
    auth = getAuth(app);
  }
} catch (err) {
  // Never let init errors crash the app - fall back to demo mode.
  console.warn("[Firebase] init skipped:", err);
  firebaseEnabled = false;
  auth = null;
}

const isEnabled = () => firebaseEnabled && !!auth;

/**
 * Turn a raw Firebase Auth error into a short, friendly message
 * that's safe to show directly in a toast. Also tags whether the
 * failure means "this provider isn't configured / this domain
 * isn't authorized" so callers can offer a graceful fallback.
 */
function describeError(err) {
  const code = err && err.code ? String(err.code) : "";
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with those details.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password is too weak. Use at least 8 characters.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/cancelled-popup-request": "Sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Please allow popups and try again.",
    "auth/account-exists-with-different-credential":
      "An account already exists using a different sign-in method. Try logging in with that method instead.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again."
  };
  // Codes that specifically mean "provider/domain not set up" -
  // these are the ones worth gracefully falling back to OTP for,
  // rather than just showing an error and stopping.
  const unavailableCodes = new Set([
    "auth/operation-not-allowed",
    "auth/unauthorized-domain",
    "auth/configuration-not-found",
    "auth/invalid-oauth-provider",
    "auth/internal-error"
  ]);
  const unavailable = unavailableCodes.has(code);
  const message =
    map[code] ||
    (unavailable
      ? "This sign-in method isn't set up for this domain yet."
      : (err && err.message) || "Something went wrong. Please try again.");
  return { message, unavailable, cancelled: code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" };
}

const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms));

export const authService = {
  isEnabled,

  /** Sign in with email/username + password. */
  async login(email, password) {
    if (isEnabled()) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return { user: cred.user, demo: false };
      } catch (err) {
        const { message } = describeError(err);
        throw new Error(message);
      }
    }
    await delay();
    console.log("[Firebase][Demo] login", { email });
    return { user: { uid: "demo-user-id", email }, demo: true };
  },

  /** Create a new user with email + password, then sign them in. */
  async signup({ name, email, password }) {
    if (isEnabled()) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          try {
            await updateProfile(cred.user, { displayName: name });
          } catch (profileErr) {
            console.warn("[Firebase] updateProfile failed:", profileErr);
          }
        }
        return { user: cred.user, demo: false };
      } catch (err) {
        const { message } = describeError(err);
        throw new Error(message);
      }
    }
    await delay();
    console.log("[Firebase][Demo] signup", { name, email });
    return { user: { uid: "demo-user-id", email, name }, demo: true };
  },

  /** Send a password reset email. */
  async sendPasswordReset(email) {
    if (isEnabled()) {
      try {
        await sendPasswordResetEmail(auth, email);
        return { ok: true, demo: false };
      } catch (err) {
        const { message } = describeError(err);
        throw new Error(message);
      }
    }
    await delay();
    console.log("[Firebase][Demo] sendPasswordReset", { email });
    return { ok: true, demo: true };
  },

  /**
   * Sign in with a third-party popup provider ("google" | "microsoft").
   * On failure, throws an Error whose `.fallbackToOtp` flag tells the
   * caller whether this looks like a "not configured for this
   * domain" situation worth gracefully falling back to OTP for,
   * versus a plain "you cancelled the popup" situation.
   */
  async signInWithProvider(providerName) {
    if (isEnabled()) {
      try {
        const provider =
          providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider("microsoft.com");
        const result = await signInWithPopup(auth, provider);
        return { user: result.user, demo: false };
      } catch (err) {
        const { message, unavailable, cancelled } = describeError(err);
        const wrapped = new Error(message);
        wrapped.fallbackToOtp = unavailable && !cancelled;
        wrapped.cancelled = cancelled;
        throw wrapped;
      }
    }
    await delay();
    console.log(`[Firebase][Demo] signInWithProvider "${providerName}"`);
    return { user: { uid: "demo-provider-user", provider: providerName }, demo: true };
  }
};
