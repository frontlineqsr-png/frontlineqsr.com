// assets/commercial-auth.js (frontlineqsr.com)
// Minimal commercial auth: login + reset + logout + protect dashboard
// No pilot governance logic. No KPI math. Just auth plumbing.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ✅ Use the SAME Firebase project as flqsr (you already shared this config)
const firebaseConfig = {
  apiKey: "AIzaSyANTxxbSP4UMmEmrOKH8wn2UhR2GUmWiYc",
  authDomain: "frontlineqsr-prod.firebaseapp.com",
  projectId: "frontlineqsr-prod",
  storageBucket: "frontlineqsr-prod.firebasestorage.app",
  messagingSenderId: "114632679759",
  appId: "1:114632679759:web:6e207548b5a29fcecaa53a",
  measurementId: "G-8KFEXHE1TR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function init() {
  try { await setPersistence(auth, browserLocalPersistence); } catch {}
}

function $(id){ return document.getElementById(id); }

function setMsg(text, isBad=false){
  const el = $("msg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isBad ? "#b91c1c" : "#065f46";
}

function isDashboard(){
  return /\/dashboard\.html/i.test(location.pathname);
}
function isLogin(){
  return /\/login\.html/i.test(location.pathname);
}

init();

// ---- Login page wiring
if (isLogin()) {
  $("loginBtn")?.addEventListener("click", async () => {
    try {
      setMsg("");
      const email = String($("email")?.value || "").trim();
      const password = String($("password")?.value || "");
      if (!email) return setMsg("Enter email.", true);
      if (!password) return setMsg("Enter password.", true);

      await signInWithEmailAndPassword(auth, email, password);
      location.replace("./dashboard.html?v=1");
    } catch (e) {
      setMsg(e?.message || "Login failed.", true);
    }
  });

  $("resetBtn")?.addEventListener("click", async () => {
    try {
      setMsg("");
      const email = String($("email")?.value || "").trim();
      if (!email) return setMsg("Enter your email first, then click Reset Password.", true);
      await sendPasswordResetEmail(auth, email);
      setMsg("✅ Password reset email sent. Check inbox/spam.");
    } catch (e) {
      setMsg(e?.message || "Reset failed.", true);
    }
  });
}

// ---- Dashboard protection + logout
if (isDashboard()) {
  const who = $("who");
  const logoutBtn = $("logoutBtn");

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.replace("./login.html?v=1");
      return;
    }
    if (who) who.textContent = `Signed in as: ${user.email || user.uid}`;
  });

  logoutBtn?.addEventListener("click", async () => {
    try { await signOut(auth); } catch {}
    location.replace("./login.html?v=1");
  });
}