// assets/commercial-vp.js (v4)
// VP / Owner page logic
// Shared auth/session/logout is handled by commercial-page-boot.js

const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function setVPHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "vp").toUpperCase();
  const orgId = s.orgId || "N/A";
  const regions = Array.isArray(s.assigned_region_ids) ? s.assigned_region_ids : [];

  const extra = $("vpContext");
  if (extra) {
    extra.textContent =
      `Org: ${orgId} | Role: ${role} | Executive Scope: ${regions.length ? regions.join(", ") : "Enterprise visibility"}`;
  }
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      window.location.href = "./commercial-vp.html";
      return;
    }

    if (view === "rm") {
      window.location.href = "./commercial-rm.html";
      return;
    }

    if (view === "dm") {
      window.location.href = "./commercial-dm.html";
      return;
    }

    if (view === "sm") {
      window.location.href = "./commercial-portal.html";
    }
  });
}

function setupVPRegionActions() {
  const table = document.querySelector("[data-vp-region-table]");
  if (!table) return;

  table.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-region-id]");
    if (!trigger) return;

    const regionId = String(trigger.getAttribute("data-region-id") || "").trim();
    if (!regionId) return;

    console.log("[commercial-vp] open region drill-down:", regionId);

    window.location.href = `./commercial-rm.html?region=${encodeURIComponent(regionId)}`;
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setVPHeaderContext();
  setupViewSelector();
  setupVPRegionActions();
});