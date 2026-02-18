// assets/commercial-admin.js (v1)
// Commercial-only guard + admin-only gate + logout
// Reads: localStorage FLQSR_COMM_SESSION (set by commercial-auth.js)

import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const SESSION_KEY = "FLQSR_COMM_SESSION";
const $ = (id) => document.getElementById(id);

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

function normRole(role) {
  return String(role || "").trim().toLowerCase();
}

function requireCommercialAdmin() {
  const s = readSession();

  const isSuper = !!s?.isSuperAdmin || normRole(s?.role) === "super_admin";
  const role = normRole(s?.role);

  // must be logged in
  if (!s?.uid) {
    location.replace("./client-login.html");
    return null;
  }

  // must have commercial access unless super admin
  if (!isSuper && !s?.commercialAccess) {
    location.replace("./client-login.html");
    return null;
  }

  // must be admin/super admin to view this page
  if (!(isSuper || role === "admin")) {
    location.replace("./commercial-portal.html");
    return null;
  }

  return s;
}

async function doLogout() {
  try { await signOut(auth); } catch {}
  clearSession();
  location.replace("./client-login.html");
}

window.addEventListener("DOMContentLoaded", () => {
  const s = requireCommercialAdmin();
  if (!s) return;

  const line =
    `email: ${s.email || "—"}\n` +
    `role: ${s.role || "—"}\n` +
    `orgId: ${s.orgId || "—"}\n` +
    `commercialAccess: ${String(!!s.commercialAccess)}\n` +
    `isSuperAdmin: ${String(!!s.isSuperAdmin)}\n` +
    `uid: ${s.uid || "—"}`;

  const el = $("sessionLine");
  if (el) el.textContent = line;

  $("logoutBtn")?.addEventListener("click", doLogout);
});