// assets/commercial-auth.js (v1.3) — Commercial Login + Role Routing
// Uses: ./firebase.js exports { app, auth, db }
// Enforces: commercialAccess === true (unless super admin)
// Routes by role to role landing pages

import { auth, db } from "./firebase.js";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

  if (r === "store_manager" || r === "sm") return "sm";
  if (r === "district_manager" || r === "dm") return "dm";
  if (r === "regional_manager" || r === "rm") return "rm";
  if (r === "vp" || r === "owner" || r === "vp_owner" || r === "vp/owner") return "vp";
  if (r === "admin") return "admin";
  if (r === "super_admin") return "super_admin";

  // If you still have older "client" profiles, treat as SM for commercial routing
  if (r === "client") return "sm";

  return r || "sm";
}

// Role → landing page (shell pages are fine; can be empty placeholders)
function landingForRole(role) {
  const r = normRole(role);

  if (r === "super_admin" || r === "admin") return "./commercial-admin.html";
  if (r === "dm") return "./commercial-dm.html";
  if (r === "rm") return "./commercial-rm.html";
  if (r === "vp") return "./commercial-vp.html";

  return "./commercial-portal.html"; // SM default
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
    const snap = await getDoc(doc(db, "flqsr_users", user.uid));

    if (!snap.exists()) {
      setMsg("No profile found for this account. Contact admin.", true);
      try { await signOut(auth); } catch {}
      return;
    }

    const p = snap.data() || {};

    const role = normRole(p.role || "sm");
    const orgId = String(p.orgId || p.org_id || p.company_id || "").trim();
    const commercialAccess = !!(p.commercialAccess ?? p.commercial_access ?? false);

    // ✅ Enforce commercialAccess for everyone except super admin
    if (!commercialAccess) {
      setMsg("Commercial access is not enabled for this account.", true);
      try { await signOut(auth); } catch {}
      return;
    }

    // ✅ Enforce orgId for non-admin
    if (role !== "admin" && !orgId) {
      setMsg("Profile missing orgId. Contact admin.", true);
      try { await signOut(auth); } catch {}
      return;
    }

    // ✅ Route
    location.href = landingForRole(role);

  } catch (e) {
    console.error("[commercial-auth] routeCommercial error:", e);
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