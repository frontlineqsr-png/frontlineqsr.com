// assets/commercial-auth.js (debug-stable)
// Purpose: client-login.html auth wiring + visible status

import { auth } from "./firebase.js";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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

async function doLogin() {
  try {
    setMsg("");

    const email = String($("email")?.value || "").trim();
    const password = String($("password")?.value || "").trim();

    if (!email) throw new Error("Enter your email.");
    if (!password) throw new Error("Enter your password.");

    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, password);

    setMsg("Login success ✅ Redirecting…", false);

    // Make sure this file exists at root: /commercial-portal.html
    location.href = "./commercial-portal.html";
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
  // If you see this, the JS is running.
  setMsg("Auth loaded ✅", false);

  $("loginBtn")?.addEventListener("click", doLogin);
  $("resetBtn")?.addEventListener("click", doReset);

  $("password")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") doLogin();
  });
});
