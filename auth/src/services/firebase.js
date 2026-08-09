// ============================================================
// FIREBASE AUTHENTICATION SERVICE
// ------------------------------------------------------------
// Safe wrapper around Firebase Auth. Reads keys from the
// environment via `config.js`. If Firebase is not configured
// (missing/placeholder keys), every call automatically falls
// back to an internal Mock/Demo Mode so the UI never crashes
// with a white screen.
//
// To enable real Firebase auth:
//   1. Add the env vars to a `.env` file (see config.js notes).
//   2. `npm i firebase` in the auth folder.
//   3. Uncomment the firebase imports below.
// ============================================================

// import { initializeApp } from "firebase/app";
// import {
//   getAuth,
//   createUserWithEmailAndPassword,
//   signInWithEmailAndPassword,
//   sendPasswordResetEmail,
//   signInWithPopup,
//   GoogleAuthProvider,
//   OAuthProvider,
//   updateProfile
// } from "firebase/auth";

import { isFirebaseConfigured, firebase } from "../config.js";

// ---- Optional real Firebase instance (only if configured) ----
let auth = null;
let firebaseEnabled = false;

try {
  firebaseEnabled = isFirebaseConfigured();
  if (firebaseEnabled) {
    // If you installed `firebase`, uncomment these lines and the
    // imports above to actually initialise the SDK.
    //
    // const app = initializeApp({
    //   apiKey: firebase.apiKey.value,
    //   authDomain: firebase.authDomain.value,
    //   projectId: firebase.projectId.value,
    //   storageBucket: firebase.storageBucket.value,
    //   messagingSenderId: firebase.messagingSenderId.value,
    //   appId: firebase.appId.value
    // });
    // auth = getAuth(app);
    //
    // NOTE: The firebase package is not installed by default, so we
    // keep this disabled to avoid a runtime import error. Uncomment
    // once you `npm i firebase`.
    firebaseEnabled = false;
  }
} catch (err) {
  // Never let init errors crash the app.
  console.warn("[Firebase] init skipped:", err);
  firebaseEnabled = false;
}

const isEnabled = () => firebaseEnabled && auth;

/**
 * Simulate a small network delay so loading states are visible
 * and the UX feels realistic in demo mode.
 */
const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms));

export const authService = {
  /**
   * Sign in with email + password.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    if (isEnabled()) {
      // const cred = await signInWithEmailAndPassword(auth, email, password);
      // return cred.user;
    }
    await delay();
    console.log("[Firebase][Demo] login", { email });
    return { uid: "demo-user-id", email, demo: true };
  },

  /**
   * Create a new user with email + password.
   */
  async signup({ name, email, password }) {
    if (isEnabled()) {
      // const cred = await createUserWithEmailAndPassword(auth, email, password);
      // await updateProfile(cred.user, { displayName: name });
      // return cred.user;
    }
    await delay();
    console.log("[Firebase][Demo] signup", { name, email });
    return { uid: "demo-user-id", email, name, demo: true };
  },

  /**
   * Send a password reset email.
   */
  async sendPasswordReset(email) {
    if (isEnabled()) {
      // await sendPasswordResetEmail(auth, email);
    }
    await delay();
    console.log("[Firebase][Demo] sendPasswordReset", { email });
    return { ok: true, demo: true };
  },

  /**
   * Sign in with a third-party popup provider.
   * @param {"google"|"microsoft"} providerName
   */
  async signInWithProvider(providerName) {
    if (isEnabled()) {
      // const provider =
      //   providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider("microsoft.com");
      // const result = await signInWithPopup(auth, provider);
      // return result.user;
    }
    await delay();
    console.log(`[Firebase][Demo] signInWithProvider "${providerName}"`);
    return { uid: "demo-provider-user", provider: providerName, demo: true };
  }
};
