// assets/commercial-page-boot.js (v1.6)
// Shared boot for commercial role-gated pages (NO PILOT DATA)
// ✅ Guard + session display + logout
// ✅ Firebase truth check
// ✅ Firestore revalidation on load/focus
// ✅ Session refresh
// ✅ Handles role/access drift safely

import {
  requireCommercial,
  getCommercialSession,
  saveCommercialSession,
  clearCommercialSession,
} from "./commercial-guard.js";

import { auth, db } from "./firebase.js";

import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function $(id) {
  return document.getElementById(id);
}

function normRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "store_manager" || r === "sm") return "sm";
  if (r === "district_manager" || r === "dm") return "dm";
  if (r === "regional_manager" || r === "rm") return "rm";
  if (r === "vp" || r === "owner" || r === "vp_owner" || r === "vp/owner") return "vp";
  if (r === "admin") return "admin";
  if (r === "super_admin") return "super_admin";
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

function samePath(target) {
  const current = location.pathname.split("/").pop() || "";
  const next = String(target || "").replace("./", "");
  return current === next;
}

async function loadDirectory(uid) {
  const snap = await getDoc(doc(db, "commercial_users", uid));
  return snap.exists() ? (snap.data() || {}) : null;
}

async function loadOrgUser(orgId, uid) {
  const snap = await getDoc(doc(db, "orgs", orgId, "users", uid));
  return snap.exists() ? (snap.data() || {}) : null;
}

async function rebuildCommercialSession(user) {
  if (!user?.uid) throw new Error("Missing authenticated user.");

  const uid = user.uid;
  const email = String(user.email || "").trim().toLowerCase();

  const dir = await loadDirectory(uid);
  if (!dir) throw new Error("No commercial directory profile found.");

  const commercialAccess = !!(dir.commercialAccess ?? dir.commercial_access ?? false);
  const isSuperAdmin = !!(dir.isSuperAdmin ?? dir.is_super_admin ?? false);
  const orgId = String(dir.orgId || dir.org_id || "").trim();
  const roleFromDir = normRole(dir.role || "sm");

  if (!commercialAccess && !isSuperAdmin) {
    throw new Error("Commercial access is disabled for this account.");
  }

  if (!orgId && !isSuperAdmin) {
    throw new Error("Commercial directory profile is missing orgId.");
  }

  let orgUser = null;
  if (orgId) {
    orgUser = await loadOrgUser(orgId, uid);
    if (!orgUser && !isSuperAdmin) {
      throw new Error("Org user profile missing.");
    }
    if (orgUser && orgUser.active === false) {
      throw new Error("Org user profile is inactive.");
    }
  }

  const role = normRole(orgUser?.role || roleFromDir);

  const session = {
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
  };

  saveCommercialSession(session);
  return session;
}

function setSessionInfo(el, session) {
  if (!el || !session) return;
  const org = session.orgId || "N/A";
  const role = session.role || "unknown";
  el.textContent = `Org: ${org} | Role: ${role}`;
}

async function forceLogout(redirectTo) {
  try { await signOut(auth); } catch {}
  clearCommercialSession();
  location.replace(redirectTo);
}

/**
 * bootCommercialPage({
 *   allowRoles: ["sm","dm","rm","vp","admin","super_admin"],
 *   requireOrg: true,
 *   sessionInfoId: "sessionInfo",
 *   logoutBtnId: "logoutBtn",
 *   redirectTo: "./client-login.html"
 * })
 */
export function bootCommercialPage(opts = {}) {
  const {
    allowRoles = ["sm","dm","rm","vp","admin","super_admin"],
    requireOrg = true,
    sessionInfoId = "sessionInfo",
    logoutBtnId = "logoutBtn",
    redirectTo = "./client-login.html",
    maxSessionHours = 12,
  } = opts;

  const session = requireCommercial({
    allowRoles,
    requireOrg,
    redirectTo,
    maxSessionHours,
  });

  if (!session) return null;

  let refreshing = false;

  async function refreshFromSource() {
    if (refreshing) return;
    refreshing = true;

    try {
      const user = auth.currentUser;
      const cached = getCommercialSession();

      // Firebase is source of truth
      if (!user?.uid) {
        await forceLogout(redirectTo);
        return;
      }

      // UID mismatch = bad cached session
      if (!cached?.uid || cached.uid !== user.uid) {
        const fresh = await rebuildCommercialSession(user);
        const target = landingForRole(fresh.isSuperAdmin ? "super_admin" : fresh.role);
        if (!samePath(target)) {
          location.replace(target);
          return;
        }
        setSessionInfo($(sessionInfoId), fresh);
        return;
      }

      // Refresh from Firestore to catch role/access drift
      const fresh = await rebuildCommercialSession(user);

      // If current page no longer matches role, reroute
      const target = landingForRole(fresh.isSuperAdmin ? "super_admin" : fresh.role);
      if (!samePath(target)) {
        location.replace(target);
        return;
      }

      setSessionInfo($(sessionInfoId), fresh);
    } catch (e) {
      console.error("[commercial-page-boot] refresh failed:", e);
      await forceLogout(redirectTo);
    } finally {
      refreshing = false;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    setSessionInfo($(sessionInfoId), session);

    const btn = $(logoutBtnId);
    btn?.addEventListener("click", async () => {
      await forceLogout(redirectTo);
    });

    // Initial refresh after DOM loads
    refreshFromSource();

    // Refresh when user comes back to the tab
    window.addEventListener("focus", refreshFromSource);

    // Firebase auth truth check
    onAuthStateChanged(auth, async (user) => {
      if (!user?.uid) {
        await forceLogout(redirectTo);
        return;
      }
      const cached = getCommercialSession();
      if (!cached?.uid || cached.uid !== user.uid) {
        await refreshFromSource();
      }
    });
  });

  return session;
}