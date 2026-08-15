// ============================================================
// FIREBASE AUTHENTICATION SERVICE
// ------------------------------------------------------------
// Real wrapper around Firebase Auth (email/password, Google,
// Microsoft, and phone OTP). Reads keys from the environment via
// `config.js`. If Firebase is not configured (missing/placeholder
// keys), every call automatically falls back to an internal
// Mock/Demo Mode so the UI never crashes with a white screen and
// still lets you click through the flow to see how it behaves.
//
// To enable real auth:
//   1. Create a Firebase project at https://console.firebase.google.com
//   2. Authentication -> Sign-in method -> enable Email/Password,
//      Google, Microsoft, and Phone.
//   3. Add a Web app to the project to get your config values.
//   4. Create `auth/.env` (see `auth/.env.example`) with the
//      VITE_FIREBASE_* values from step 3.
//   5. Add your production domain (and localhost) under
//      Authentication -> Settings -> Authorized domains.
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
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
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
 * that's safe to show directly in a toast.
 */
function friendlyError(err) {
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
    "auth/account-exists-with-different-credential": "An account already exists using a different sign-in method. Try logging in with that method instead.",
    "auth/unauthorized-domain": "This domain isn't authorized for sign-in yet. Add it under Firebase Authentication > Settings > Authorized domains.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/invalid-phone-number": "That phone number doesn't look right.",
    "auth/code-expired": "That code has expired. Please request a new one.",
    "auth/invalid-verification-code": "That code isn't correct. Please try again.",
    "auth/missing-verification-code": "Please enter the code you received.",
    "auth/operation-not-allowed": "This sign-in method isn't enabled for this project yet."
  };
  return map[code] || (err && err.message) || "Something went wrong. Please try again.";
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
        throw new Error(friendlyError(err));
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
        throw new Error(friendlyError(err));
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
        throw new Error(friendlyError(err));
      }
    }
    await delay();
    console.log("[Firebase][Demo] sendPasswordReset", { email });
    return { ok: true, demo: true };
  },

  /** Sign in with a third-party popup provider ("google" | "microsoft"). */
  async signInWithProvider(providerName) {
    if (isEnabled()) {
      try {
        const provider =
          providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider("microsoft.com");
        const result = await signInWithPopup(auth, provider);
        return { user: result.user, demo: false };
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    }
    await delay();
    console.log(`[Firebase][Demo] signInWithProvider "${providerName}"`);
    return { user: { uid: "demo-provider-user", provider: providerName }, demo: true };
  },

  /**
   * Phone auth, step 1: send an OTP via SMS using an invisible
   * reCAPTCHA bound to the DOM node with id `containerId`.
   * Returns a confirmation handle to pass into verifyPhoneOtp.
   */
  async sendPhoneOtp(fullPhoneNumber, containerId = "recaptcha-container") {
    if (isEnabled()) {
      try {
        if (!window.__archinthRecaptcha) {
          window.__archinthRecaptcha = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
        }
        const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, window.__archinthRecaptcha);
        return { confirmation, demo: false };
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    }
    await delay();
    console.log("[Firebase][Demo] sendPhoneOtp", { fullPhoneNumber });
    return { confirmation: null, demo: true };
  },

  /** Phone auth, step 2: confirm the code the user received. */
  async verifyPhoneOtp(confirmation, code) {
    if (confirmation) {
      try {
        const cred = await confirmation.confirm(code);
        return { user: cred.user, demo: false };
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    }
    await delay();
    console.log("[Firebase][Demo] verifyPhoneOtp", { code });
    return { user: { uid: "demo-phone-user" }, demo: true };
  },

  /**
   * Passwordless email sign-in, step 1: email the user a magic
   * link. `completionUrl` must be an authorized domain page that
   * calls completeEmailLinkSignIn() on load (the /auth page itself
   * does this automatically).
   */
  async sendEmailSignInLink(email, completionUrl) {
    if (isEnabled()) {
      try {
        await sendSignInLinkToEmail(auth, email, { url: completionUrl, handleCodeInApp: true });
        window.localStorage.setItem("archinthai:emailForSignIn", email);
        return { ok: true, demo: false };
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    }
    await delay();
    console.log("[Firebase][Demo] sendEmailSignInLink", { email });
    return { ok: true, demo: true };
  },

  /**
   * Passwordless email sign-in, step 2: call this on page load. If
   * the current URL is a valid sign-in link, completes the sign-in
   * and returns the user; otherwise returns null.
   */
  async completeEmailLinkSignIn() {
    if (!isEnabled()) return null;
    try {
      if (!isSignInWithEmailLink(auth, window.location.href)) return null;
      let email = window.localStorage.getItem("archinthai:emailForSignIn");
      if (!email) return null; // Need the email to complete sign-in; bail out quietly.
      const cred = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem("archinthai:emailForSignIn");
      return { user: cred.user, demo: false };
    } catch (err) {
      console.warn("[Firebase] completeEmailLinkSignIn failed:", err);
      return null;
    }
  }
};
