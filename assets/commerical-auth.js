// assets/commercial-auth.js (v1.1)
// Commercial login controller for frontlineqsr.com
// - Uses same Firebase project + profile rules as flqsr.com
// - Builds FLQSR_SESSION locally
// - Routes to commercial pages (NOT flqsr.com)
// Requirements:
//   - assets/firebase.js exists and exports { auth }
//   - assets/profile.js exists and exports { isSuperAdminEmail, superAdminProfile, fetchUserProfile }

import { auth } from "./firebase.js";
import { isSuperAdminEmail, superAdminProfile, fetchUserProfile } from "./profile.js";

import {
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const SESSION_KEY = "FLQSR_SESSION";

const $ = (id) => document.getElementById(id);

function safeParse(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
function saveSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s || null)); } catch {} }
function loadSession() { return safeParse(localStorage.getItem(SESSION_KEY) || "null", null); }

function setMsg(text, isError = false) {
  const el = $("msg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "#b91c1c" : "#065f46";
}

function nowISO() { return new Date().toISOString(); }

// ---- Build session (same pattern as pilot auth.js)
async function buildSessionFromUser(user) {
  if (!user) return null;

  const uid = user.uid;
  const email = user.email || "";

  // 1) SUPER ADMIN OVERRIDE
  if (isSuperAdminEmail?.(email)) {
    return {
      ...superAdminProfile(uid, email),
      at: nowISO(),
      profile_status: "super_admin"
    };
  }

  // 2) Firestore profile
  let profile = null;
  try { profile = await fetchUserProfile(uid); }
  catch (e) { console.warn("[COMM AUTH] profile fetch failed:", e); }

  if (!profile) {
    return {
      uid,
      email,
      role: "client",
      company_id: "",
      assigned_store_ids: [],
      at: nowISO(),
      profile_status: "pending"
    };
  }

  const role = String(profile.role || "client").toLowerCase();
  const normalizedRole =
    role === "admin" ? "admin" :
    role === "super_admin" ? "super_admin" :
    "client";

  return {
    uid,
    email: profile.email || email,
    role: normalizedRole,
    company_id: profile.company_id || "",
    assigned_store_ids: Array.isArray(profile.assigned_store_ids) ? profile.assigned_store_ids : [],
    at: nowISO(),
    profile_status: "ok"
  };
}

async function initPersistence() {
  try { await setPersistence(auth, browserLocalPersistence); }
  catch (e) { console.warn("[COMM AUTH] persistence failed:", e?.message || e); }
}

function routeAfterLogin(session) {
  const role = String(session?.role || "").toLowerCase();

  // ✅ Commercial routes only (never flqsr.com)
  if (role === "super_admin" || role === "admin") {
    location.replace("./commercial-admin.html");
    return;
  }

  if (session?.profile_status === "pending") {
    // If you want a pending page later, swap this.
    setMsg("Your account is pending activation. Contact your admin.", true);
    return;
  }

  location.replace("./commercial-portal.html");
}

// ---- Handlers
async function handleLogin() {
  setMsg("");

  const email = String($("email")?.value || "").trim();
  const password = String($("password")?.value || "");

  if (!email) return setMsg("Enter your email.", true);
  if (!password) return setMsg("Enter your password.", true);

  try {
    await initPersistence();
    const cred = await signInWithEmailAndPassword(auth, email, password);

    const session = await buildSessionFromUser(cred.user);
    saveSession(session);

    if (!session?.uid) throw new Error("session_missing_uid");

    routeAfterLogin(session);
  } catch (e) {
    console.error(e);
    // Common Firebase errors are in e.code
    const code = e?.code || e?.message || "Login failed.";
    setMsg(code, true);
  }
}

async function handleReset() {
  setMsg("");

  const email = String($("email")?.value || "").trim();
  if (!email) return setMsg("Type your email first, then click Reset Password.", true);

  try {
    await initPersistence();
    await sendPasswordResetEmail(auth, email);
    setMsg("Password reset email sent. Check your inbox/spam.");
  } catch (e) {
    console.error(e);
    const code = e?.code || e?.message || "Reset failed.";
    setMsg(code, true);
  }
}

// ---- Wire buttons + auto-route if already logged in
window.addEventListener("DOMContentLoaded", () => {
  $("loginBtn")?.addEventListener("click", handleLogin);
  $("resetBtn")?.addEventListener("click", handleReset);

  // If session already exists, route user without showing login again
  const s = loadSession();
  if (s?.uid) {
    // Keep it simple: route based on stored role
    routeAfterLogin(s);
  }
});