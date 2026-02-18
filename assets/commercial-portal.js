// assets/commercial-portal.js (v1)
// Commercial-only guard + logout
// Reads: localStorage FLQSR_COMM_SESSION (set by commercial-auth.js)
// Uses Firebase signOut to end session

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

function requireCommercialSession() {
  const s = readSession();

  // Must exist + must have commercialAccess unless super admin
  const isSuper = !!s?.isSuperAdmin || String(s?.role || "") === "super_admin";
  const okAccess = isSuper || !!s?.commercialAccess;

  if (!s?.uid || !okAccess) {
    // Always route to commercial login (NOT flqsr)
    location.replace("./client-login.html");
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
  const s = requireCommercialSession();
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