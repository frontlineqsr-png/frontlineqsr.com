// assets/commercial-auth.js (v1.2) — Commercial Login + Role Routing
// - Uses same Firebase project + same Firestore profile collection (flqsr_users) for now
// - Enforces: commercialAccess === true (unless super admin)
// - Routes by role to role landing pages
// NOTE: This file assumes /assets/firebase.js exports BOTH { app, auth }

import { app, auth } from "./firebase.js";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const db = getFirestore(app);

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

// ✅ Super Admin override (commercial should always let you in)
const SUPER_ADMIN_EMAILS = [
  "nrobinson@flqsr.com",
  "robinson8605@gmail.com",
];

function isSuperAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.map(x => x.toLowerCase()).includes(e);
}

function normRole(role) {
  const r = String(role || "").trim().toLowerCase();
  // accept common variants
  if (r === "store_manager" || r === "sm") return "sm";
  if (r === "district_manager" || r === "dm") return "dm";
  if (r === "regional_manager" || r === "rm") return "rm";
  if (r === "vp" || r === "owner" || r === "vp_owner" || r === "vp/owner") return "vp";
  if (r === "admin") return "admin";
  if (r === "super_admin") return "super_admin";
  return r || "client";
}

// Role → landing page (you can rename later; these are the “structure hooks”)
function landingForRole(role) {
  const r = normRole(role);

  if (r === "super_admin" || r === "admin") return "./commercial-admin.html";
  if (r === "dm") return "./commercial-dm.html";
  if (r === "rm") return "./commercial-rm.html";
  if (r === "vp") return "./commercial-vp.html";

  // default SM/client
  return "./commercial-portal.html";
}

async function routeCommercial(user) {
  try {
    if (!user?.uid) {
      location.href = "./commercial-portal.html";
      return;
    }

    const email = user.email || "";

    // ✅ Super Admin always allowed + always routes to commercial admin
    if (isSuperAdminEmail(email)) {
      location.href = "./commercial-admin.html";
      return;
    }

    // ✅ Read profile (shared collection for now)
    const ref = doc(db, "flqsr_users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // No profile = no commercial access (prevents random logins)
      setMsg("No profile found for this account. Contact admin.", true);
      try { await signOut(auth); } catch {}
      return;
    }

    const p = snap.data() || {};

    const role = normRole(p.role || "client");
    const orgId = String(p.orgId || p.org_id || p.company_id || "").trim();
    const commercialAccess = !!(p.commercialAccess ?? p.commercial_access ?? false);

    // ✅ Enforce commercialAccess (role-based structure requirement)
    if (!commercialAccess) {
      setMsg("Commercial access is not enabled for this account.", true);
      try { await signOut(auth); } catch {}
      return;
    }

    // ✅ Enforce orgId for non-admin roles (keeps structure clean)
    // (Super admin handled above; admin would typically be allowed even without orgId)
    if (role !== "admin" && !orgId) {
      setMsg("Profile missing orgId. Contact admin.", true);
      try { await signOut(auth); } catch {}
      return;
    }

    // Route
    location.href = landingForRole(role);

  } catch (e) {
    console.error("[commercial-auth] routeCommercial error:", e);
    // safest fallback: portal, but do not hide the error from you
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
    await routeCommercial(cred.user);

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