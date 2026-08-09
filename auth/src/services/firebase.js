// ============================================================
// FIREBASE AUTHENTICATION SERVICE
// ------------------------------------------------------------
// Placeholder integration ready to connect to a real Firebase
// project. To enable:
//   1. Create a Firebase project at https://console.firebase.google.com
//   2. Add your web app and copy the config below.
//   3. Uncomment the initializeApp/getAuth lines and paste config.
//   4. Enable the sign-in methods you need in the Firebase console
//      (Email/Password, Google, Microsoft).
// ============================================================

// import { initializeApp } from "firebase/app";
// import {
//   getAuth,
//   createUserWithEmailAndPassword,
//   signInWithEmailAndPassword,
//   sendPasswordResetEmail,
//   signInWithPopup,
//   GoogleAuthProvider,
//   OAuthProvider
// } from "firebase/auth";

// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_PROJECT.firebaseapp.com",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_PROJECT.appspot.com",
//   messagingSenderId: "YOUR_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };

// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);

export const authService = {
  /**
   * Sign in with email + password.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    // const cred = await signInWithEmailAndPassword(auth, email, password);
    // return cred.user;
    console.log("[Firebase] login (stub)", { email });
    return { uid: "stub-user-id", email };
  },

  /**
   * Create a new user with email + password.
   */
  async signup({ name, email, password }) {
    // const cred = await createUserWithEmailAndPassword(auth, email, password);
    // await updateProfile(cred.user, { displayName: name });
    // return cred.user;
    console.log("[Firebase] signup (stub)", { name, email });
    return { uid: "stub-user-id", email, name };
  },

  /**
   * Send a password reset email.
   */
  async sendPasswordReset(email) {
    // await sendPasswordResetEmail(auth, email);
    console.log("[Firebase] sendPasswordReset (stub)", { email });
    return { ok: true };
  },

  /**
   * Sign in with a third-party popup provider.
   * @param {"google"|"microsoft"} providerName
   */
  async signInWithProvider(providerName) {
    // const provider =
    //   providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider("microsoft.com");
    // const result = await signInWithPopup(auth, provider);
    // return result.user;
    console.log(`[Firebase] signInWithProvider (stub) "${providerName}"`);
    return { uid: "stub-provider-user", provider: providerName };
  }
};
