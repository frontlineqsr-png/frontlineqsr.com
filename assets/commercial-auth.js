// assets/commercial-auth.js (role-routed)
// Purpose: client-login.html auth wiring + role-based routing

import { auth } from "./firebase.js";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const db = getFirestore();

const $ = (id) => document.getElementById(id);

function setMsg(text, isError = false) {
  const el = $("msg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "#b91c1c" : "#065f46";
}

function errText(e) {
  const code = e?.code ? String(e.code) : "";
  const msg  = e?.message ? String(e.message) : String(e || "Unknown error");
  return code ? `${code}\n${msg}` : msg;
}

async function routeByRole(uid) {
  try {
    if (!uid) {
      location.href = "./commercial-portal.html";
      return;
    }

    const snap = await getDoc(doc(db, "flqsr_users", uid));

    let role = "client";

    if (snap.exists()) {
      role = String(snap.data()?.role || "client").toLowerCase();
    }

    if (role === "admin" || role === "super_admin") {
      location.href = "./commercial-admin.html";
    } else {
      location.href = "./commercial-portal.html";
    }

  } catch (e) {
    console.error("Role routing error:", e);
    location.href = "./commercial-portal.html";
  }
}

async function doLogin() {
  try {
    setMsg("");

    const email = String($("email")?.value || "").trim();
    const password = String($("password")?.value || "").trim();

    if (!email) throw new Error("Enter your email.");
    if (!password) throw new Error("Enter your password.");

    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);

    setMsg("Login success ✅ Redirecting…", false);

    await routeByRole(cred.user.uid);

  } catch (e) {
    console.error("[commercial-auth] login failed:", e);
    setMsg("Login failed ❌\n" + errText(e), true);
  }
}

async function doReset() {
  try {
    setMsg("");

    const email = String($("email")?.value || "").trim();
    if (!email) throw new Error("Enter your email first.");

    await sendPasswordResetEmail(auth, email);
    setMsg("Password reset email sent ✅ Check your inbox.", false);

  } catch (e) {
    console.error("[commercial-auth] reset failed:", e);
    setMsg("Reset failed ❌\n" + errText(e), true);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  setMsg("Auth loaded ✅", false);

  $("loginBtn")?.addEventListener("click", doLogin);
  $("resetBtn")?.addEventListener("click", doReset);

  $("password")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") doLogin();
  });
});
