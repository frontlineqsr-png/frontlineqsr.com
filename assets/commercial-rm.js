// assets/commercial-rm.js (v1)
// Regional Manager page logic
// Uses shared commercial boot file for auth/session/logout
// Safe to expand later for district drill-down, filters, and rollups

const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function setRMHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "rm").toUpperCase();
  const orgId = s.orgId || "N/A";
  const regions = Array.isArray(s.assigned_region_ids) ? s.assigned_region_ids : [];

  const extra = $("rmContext");
  if (extra) {
    extra.textContent =
      `Org: ${orgId} | Role: ${role} | Region Scope: ${regions.length ? regions.join(", ") : "All assigned regional access"}`;
  }
}

function setupRMDistrictActions() {
  const table = document.querySelector("[data-rm-district-table]");
  if (!table) return;

  table.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-district-id]");
    if (!trigger) return;

    const districtId = trigger.getAttribute("data-district-id");
    if (!districtId) return;

    // Placeholder for future RM → DM drill-down routing
    console.log("[commercial-rm] open district drill-down:", districtId);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setRMHeaderContext();
  setupRMDistrictActions();
});