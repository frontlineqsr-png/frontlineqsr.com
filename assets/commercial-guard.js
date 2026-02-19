// assets/commercial-guard.js (v1.3)
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

  const allow = (Array.isArray(allowRoles) ? allowRoles : [])
    .map(r => String(r || "").trim().toLowerCase())
    .filter(Boolean);

  const s = getCommercialSession();
  const role = String(s?.role || "").trim().toLowerCase();

  const isPrivileged =
    role === "admin" ||
    role === "super_admin" ||
    !!s?.isSuperAdmin;

  // must have session + commercialAccess (unless privileged)
  if (!s?.uid || (!s?.commercialAccess && !isPrivileged)) {
    clearCommercialSession();
    location.replace(redirectTo);
    return null;
  }

  // role must be allowed (if allow list provided)
  if (allow.length > 0 && !allow.includes(role)) {
    clearCommercialSession();
    location.replace(redirectTo);
    return null;
  }

  // org required unless privileged or requireOrg=false
  if (requireOrg && !isPrivileged) {
    const orgId = String(s.orgId || "").trim();
    if (!orgId) {
      clearCommercialSession();
      location.replace(redirectTo);
      return null;
    }
  }

  return s; // return session for page use
}
