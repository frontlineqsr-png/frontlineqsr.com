// assets/commercial-guard.js (v1.0)
// Commercial-only page gate (NO pilot data)
// Requires FLQSR_COMM_SESSION set by commercial-auth.js
// Usage (in any commercial page):
//   <script type="module">
//     import { requireCommercial } from "./assets/commercial-guard.js";
//     requireCommercial({ allowRoles:["sm","dm","rm","vp","admin","super_admin"] });
//   </script>

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

  if (!s?.uid || !s?.commercialAccess) {
    clearCommercialSession();
    location.replace(redirectTo);
    return false;
  }

  const role = String(s.role || "").toLowerCase();

  // super admin bypasses org requirement
  if (requireOrg && !s.isSuperAdmin && !String(s.orgId || "").trim()) {
    clearCommercialSession();
    location.replace(redirectTo);
    return false;
  }

  if (allowRoles && Array.isArray(allowRoles) && !allowRoles.includes(role)) {
    // if role not permitted, route to the safest default
    location.replace("./commercial-portal.html");
    return false;
  }

  return true;
}