// assets/commercial-portal.js (v2)
// Commercial portal guard + tabs + logout
// Reads session from localStorage (set by commercial-auth.js)

import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const SESSION_KEY = "FLQSR_COMM_SESSION";
const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

/* =========================================================
   SESSION GUARD
========================================================= */

function requireCommercialSession() {
  const s = readSession();

  const isSuper =
    !!s?.isSuperAdmin || String(s?.role || "") === "super_admin";

  const okAccess = isSuper || !!s?.commercialAccess;

  if (!s?.uid || !okAccess) {
    location.replace("./client-login.html");
    return null;
  }

  return s;
}

/* =========================================================
   LOGOUT
========================================================= */

async function doLogout() {
  try { await signOut(auth); } catch {}
  clearSession();
  location.replace("./client-login.html");
}

/* =========================================================
   TAB SYSTEM
========================================================= */

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {

      const tab = btn.dataset.tab;

      // deactivate buttons
      buttons.forEach(b => b.classList.remove("active"));

      // activate clicked
      btn.classList.add("active");

      // hide panels
      document.querySelectorAll(".tab-panel").forEach(p => {
        p.classList.remove("active");
      });

      // show panel
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add("active");

    });
  });
}

/* =========================================================
   BOOT
========================================================= */

window.addEventListener("DOMContentLoaded", () => {

  const s = requireCommercialSession();
  if (!s) return;

  // Display session info
  const line =
    `email: ${s.email || "—"}\n` +
    `role: ${s.role || "—"}\n` +
    `orgId: ${s.orgId || "—"}\n` +
    `commercialAccess: ${String(!!s.commercialAccess)}\n` +
    `isSuperAdmin: ${String(!!s.isSuperAdmin)}\n` +
    `uid: ${s.uid || "—"}`;

  const el = $("sessionInfo");
  if (el) el.textContent = line;

  // Setup tabs
  setupTabs();

  // Logout
  $("logoutBtn")?.addEventListener("click", doLogout);

});