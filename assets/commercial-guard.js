// assets/commercial-guard.js (v1.1)
// Commercial-only page gate (NO pilot data)
// Requires FLQSR_COMM_SESSION set by commercial-auth.js

const SESSION_KEY = "FLQSR_COMM_SESSION";

function safeParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function getCommercialSession() {
  const raw = (() => {
    try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
  })();
  return safeParse(raw || "null", null);
}

export function clearCommercialSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function requireCommercial(opts = {}) {
  const {
    allowRoles = ["sm","dm","rm","vp","admin","super_admin"],
    requireOrg = true,
    redirectTo = "./client-login.html",
  } = opts;

  const s = getCommercialSession();

  // must have session + commercialAccess
  if (!s?.uid || !s?.commercialAccess) {
    clearCommercialSession();
    location.replace(redirectTo);
    return false;
  }

  const role = String(s.role || "").toLowerCase();

  // role must be allowed
  if (!allowRoles.includes(role)) {
    location.replace(redirectTo);
    return false;
  }

  // org required unless admin/super_admin or requireOrg=false
  const isPrivileged = role === "admin" || role === "super_admin" || !!s.isSuperAdmin;
  if (requireOrg && !isPrivileged) {
    const orgId = String(s.orgId || "").trim();
    if (!orgId) {
      location.replace(redirectTo);
      return false;
    }
  }

  return true;
}