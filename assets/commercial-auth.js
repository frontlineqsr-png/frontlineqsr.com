// assets/commercial-auth.js (v1.6) — Commercial Login + Org-Layer Routing (NO PILOT DATA)
// Requires:
// - ./firebase.js exports { auth, db }
// Firestore structure:
// - commercial_users/{uid}  (directory: orgId, role, commercialAccess, isSuperAdmin)
// - orgs/{orgId}/users/{uid} (org user profile: role, scopes, etc.)

import { auth, db } from "./firebase.js";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const SESSION_KEY = "FLQSR_COMM_SESSION";
let _routing = false;

// ONLY true hard super admin email(s) here
const SUPER_ADMIN_EMAILS = ["nrobinson@flqsr.com"];

function setMsg(text, isError = false) {
  const el = $("msg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "#b91c1c" : "#065f46";
}

function errText(e) {
  const code = e?.code ? String(e.code) : "";
  const msg = e?.message ? String(e.message) : String(e || "Unknown error");
  return code ? `${code}\n${msg}` : msg;
}

function isSuperAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.map((x) => x.toLowerCase()).includes(e);
}

function normRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "store_manager" || r === "sm") return "sm";
  if (r === "district_manager" || r === "dm") return "dm";
  if (r === "regional_manager" || r === "rm") return "rm";
  if (r === "vp" || r === "owner" || r === "vp_owner" || r === "vp/owner") return "vp";
  if (r === "admin") return "admin";
  if (r === "super_admin") return "super_admin";
  if (r === "client") return "sm";
  return r || "sm";
}

function landingForRole(role) {
  const r = normRole(role);
  if (r === "super_admin" || r === "admin") return "./commercial-admin.html";
  if (r === "dm") return "./commercial-dm.html";
  if (r === "rm") return "./commercial-rm.html";
  if (r === "vp") return "./commercial-vp.html";
  return "./commercial-portal.html";
}

function saveCommercialSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session || null));
  } catch {}
}

function clearCommercialSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

function getCommercialSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

async function loadDirectory(uid) {
  const snap = await getDoc(doc(db, "commercial_users", uid));
  return snap.exists() ? (snap.data() || {}) : null;
}

async function loadOrgUser(orgId, uid) {
  const snap = await getDoc(doc(db, "orgs", orgId, "users", uid));
  return snap.exists() ? (snap.data() || {}) : null;
}

async function routeCommercial(user) {
  if (_routing) return;
  _routing = true;

  try {
    if (!user?.uid) {
      location.replace("./client-login.html");
      return;
    }

    const uid = user.uid;
    const email = String(user.email || "").trim().toLowerCase();

    // Hard super admin override ONLY for real super admin email(s)
    if (isSuperAdminEmail(email)) {
      saveCommercialSession({
        uid,
        email,
        role: "super_admin",
        orgId: "",
        commercialAccess: true,
        isSuperAdmin: true,
        at: new Date().toISOString(),
        scopes: null,
        assigned_store_ids: [],
        assigned_district_ids: [],
        assigned_region_ids: [],
      });
      location.replace("./commercial-admin.html");
      return;
    }

    // Step 1: directory lookup
    const dir = await loadDirectory(uid);
    if (!dir) {
      setMsg("No commercial directory profile found. Contact admin.", true);
      try { await signOut(auth); } catch {}
      clearCommercialSession();
      return;
    }

    const orgId = String(dir.orgId || dir.org_id || "").trim();
    const commercialAccess = !!(dir.commercialAccess ?? dir.commercial_access ?? false);
    const roleFromDir = normRole(dir.role || "sm");
    const isSuperAdmin = !!(dir.isSuperAdmin ?? dir.is_super_admin ?? false);

    if (!commercialAccess && !isSuperAdmin) {
      setMsg("Commercial access is not enabled for this account.", true);
      try { await signOut(auth); } catch {}
      clearCommercialSession();
      return;
    }

    if (!orgId && !isSuperAdmin) {
      setMsg("Directory profile missing orgId. Contact admin.", true);
      try { await signOut(auth); } catch {}
      clearCommercialSession();
      return;
    }

    // Step 2: org-layer doc
    let orgUser = null;
    if (orgId) orgUser = await loadOrgUser(orgId, uid);

    if (orgId && !orgUser && !isSuperAdmin) {
      setMsg("Org user profile missing under orgs/{orgId}/users/{uid}. Contact admin.", true);
      try { await signOut(auth); } catch {}
      clearCommercialSession();
      return;
    }

    if (orgUser && orgUser.active === false) {
      setMsg("Org user profile is inactive. Contact admin.", true);
      try { await signOut(auth); } catch {}
      clearCommercialSession();
      return;
    }

    const role = normRole(orgUser?.role || roleFromDir);

    saveCommercialSession({
      uid,
      email,
      role,
      orgId,
      commercialAccess: commercialAccess || isSuperAdmin,
      isSuperAdmin,
      at: new Date().toISOString(),
      scopes: orgUser?.scopes || orgUser?.assigned_scopes || null,
      assigned_store_ids: orgUser?.assigned_store_ids || orgUser?.assignedStoreIds || [],
      assigned_district_ids: orgUser?.assigned_district_ids || orgUser?.assignedDistrictIds || [],
      assigned_region_ids: orgUser?.assigned_region_ids || orgUser?.assignedRegionIds || [],
    });

    location.replace(landingForRole(isSuperAdmin ? "super_admin" : role));
  } catch (e) {
    console.error("[commercial-auth] routeCommercial error:", e);
    setMsg("Routing failed ❌\n" + errText(e), true);
    try { await signOut(auth); } catch {}
    clearCommercialSession();
  } finally {
    setTimeout(() => { _routing = false; }, 250);
  }
}

async function doLoginFromForm() {
  try {
    setMsg("");

    const email = String($("email")?.value || "").trim();
    const password = String($("password")?.value || "").trim();

    if (!email) throw new Error("Enter your email.");
    if (!password) throw new Error("Enter your password.");

    clearCommercialSession();

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

  const form = $("loginForm");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    doLoginFromForm();
  });

  $("resetBtn")?.addEventListener("click", doReset);

  onAuthStateChanged(auth, (user) => {
    const s = getCommercialSession();
    if (user?.uid && (!s?.uid || s.uid !== user.uid)) {
      routeCommercial(user);
    }
  });
});