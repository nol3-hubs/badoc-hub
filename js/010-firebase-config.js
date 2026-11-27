/* ───────── CLOUD SYNC (Firebase Realtime Database) ─────────
   Paste the config from Firebase console > Project settings > Your apps > Web app.
   Only databaseURL is strictly needed for the Realtime Database. */
window.BADOC_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "badoc-hub-dashboard.firebaseapp.com",
  databaseURL: "https://badoc-hub-dashboard-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "badoc-hub-dashboard",
  appId: ""
};
/* Kept under the old name so every sync module keeps working. */
window.BADOC_SHARED_CONFIG = { url: window.BADOC_FIREBASE_CONFIG.databaseURL, key: window.BADOC_FIREBASE_CONFIG.apiKey || "firebase-rtdb" };
