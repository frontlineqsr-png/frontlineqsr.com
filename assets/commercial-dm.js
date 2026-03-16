// assets/commercial-dm.js (v2)
// District Manager page logic
// Uses shared commercial boot file for auth/session/logout
// This file is page-specific and safe to expand later

const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function setDMHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "dm").toUpperCase();
  const orgId = s.orgId || "N/A";
  const districts = Array.isArray(s.assigned_district_ids) ? s.assigned_district_ids : [];

  const extra = $("dmContext");
  if (extra) {
    extra.textContent =
      `Org: ${orgId} | Role: ${role} | District Scope: ${districts.length ? districts.join(", ") : "Assigned district access"}`;
  }
}

function setupDMTableActions() {
  const table = document.querySelector("[data-dm-store-table]");
  if (!table) return;

  table.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-store-id]");
    if (!trigger) return;

    const storeId = trigger.getAttribute("data-store-id");
    if (!storeId) return;

    // Placeholder for future drill-down behavior
    // Later this can route into a store detail panel or filtered SM view
    console.log("[commercial-dm] open store drill-down:", storeId);
  });
}

function highlightPendingGovernance() {
  const pendingEls = document.querySelectorAll(".tag.pending");
  pendingEls.forEach((el) => {
    el.setAttribute("title", "Pending district review or approval follow-up");
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setDMHeaderContext();
  setupDMTableActions();
  highlightPendingGovernance();
});