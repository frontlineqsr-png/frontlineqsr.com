// /assets/commercial-auth.js
import { auth } from "./firebase.js";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const $ = (id) => document.getElementById(id);

function setMsg(text, isError) {
  const el = $("msg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "#b91c1c" : "#065f46";
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

    // ✅ After login, send to commercial portal/dashboard (adjust if you want a different file)
    location.href = "./commercial-portal.html";
  } catch (e) {
    console.error(e);
    setMsg(e?.message || "Login failed.", true);
  }
}

async function doReset() {
  try {
    setMsg("");
    const email = String($("email")?.value || "").trim();
    if (!email) throw new Error("Enter your email first.");

    await sendPasswordResetEmail(auth, email);
    setMsg("✅ Password reset email sent. Check your inbox.");
  } catch (e) {
    console.error(e);
    setMsg(e?.message || "Reset failed.", true);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  $("loginBtn")?.addEventListener("click", doLogin);
  $("resetBtn")?.addEventListener("click", doReset);

  // Enter key submits
  $("password")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") doLogin();
  });
});
