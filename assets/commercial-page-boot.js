// assets/commercial-page-boot.js
// Shared boot for commercial role-gated pages (NO PILOT DATA).
// Handles: guard + session display + logout (Firebase signOut + clear session).

import { requireCommercial, clearCommercialSession } from "./commercial-guard.js";
import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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
  } = opts;

  const session = requireCommercial({ allowRoles, requireOrg, redirectTo });
  if (!session) return null; // guard already redirected

  window.addEventListener("DOMContentLoaded", () => {
    // Optional session info display
    if (sessionInfoId) {
      const el = document.getElementById(sessionInfoId);
      if (el) {
        el.textContent = `Org: ${session.orgId || "N/A"} | Role: ${session.role}`;
      }
    }

    // Logout
    const btn = document.getElementById(logoutBtnId);
    btn?.addEventListener("click", async () => {
      try { await signOut(auth); } catch {}
      clearCommercialSession();
      location.replace(redirectTo);
    });
  });

  return session;
}

