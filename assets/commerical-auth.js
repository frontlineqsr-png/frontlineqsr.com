// assets/commercial-auth.js (v1.0) — FrontlineQSR Commercial Login + Reset
// Uses Firebase Auth. No pilot storage keys. No flqsr.com redirects.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ✅ IMPORTANT:
// Use the SAME Firebase project as pilot if you want shared users,
// OR create a separate Firebase project for commercial later.
// For now, paste your existing config (from pilot firebase.js) here.

const firebaseConfig = {
  apiKey: "PASTE_YOURS",
  authDomain: "PASTE_YOURS",
  projectId: "PASTE_YOURS",
  storageBucket: "PASTE_YOURS",
  messagingSenderId: "PASTE_YOURS",
  appId: "PASTE_YOURS",
  measurementId: "PASTE_YOURS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function init() {
  try { await setPersistence(auth, browserLocalPersistence); } catch {}

  const form = document.getElementById("loginForm");
  const msg = document.getElementById("loginMsg");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const resetBtn = document.getElementById("resetBtn");

  function setMsg(t) { if (msg) msg.textContent = t || ""; }

  resetBtn?.addEventListener("click", async () => {
    try {
      setMsg("");
      const email = String(emailEl?.value || "").trim();
      if (!email) {
        setMsg("Enter your email first, then click Forgot password.");
        return;
      }
      await sendPasswordResetEmail(auth, email);
      setMsg("✅ Password reset email sent.");
    } catch (e) {
      console.error(e);
      setMsg("❌ " + (e?.code || e?.message || "Could not send reset email."));
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      setMsg("");
      const email = String(emailEl?.value || "").trim();
      const password = String(passEl?.value || "");

      await signInWithEmailAndPassword(auth, email, password);

      // ✅ Commercial routing destination:
      // Create this page next (portal.html), or change to whatever you want.
      location.replace("./portal.html");
    } catch (err) {
      console.error(err);
      setMsg("❌ " + (err?.code || err?.message || "Login failed."));
    }
  });
}

init();