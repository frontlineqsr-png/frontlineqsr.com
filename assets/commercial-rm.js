// assets/commercial-rm.js (v4)
// Regional Manager page logic
// Shared auth/session/logout is handled by commercial-page-boot.js

const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function getRegionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("region") || "").trim();
}

function prettyRegion(regionId) {
  const raw = String(regionId || "").trim();
  if (!raw) return "Assigned regional access";

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function setRMHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "rm").toUpperCase();
  const orgId = s.orgId || "N/A";
  const regions = Array.isArray(s.assigned_region_ids) ? s.assigned_region_ids : [];
  const selectedRegion = getRegionFromUrl();

  const extra = $("rmContext");
  if (extra) {
    extra.textContent =
      `Org: ${orgId} | Role: ${role} | Region Scope: ${
        selectedRegion
          ? prettyRegion(selectedRegion)
          : (regions.length ? regions.join(", ") : "Assigned regional access")
      }`;
  }

  const activeRegion = $("activeRegion");
  if (activeRegion) {
    activeRegion.textContent = selectedRegion
      ? `Selected Region: ${prettyRegion(selectedRegion)}`
      : "Selected Region: All assigned regions";
  }
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();
    const selectedRegion = getRegionFromUrl();

    if (view === "vp") {
      window.location.href = "./commercial-vp.html";
      return;
    }

    if (view === "rm") {
      if (selectedRegion) {
        window.location.href = `./commercial-rm.html?region=${encodeURIComponent(selectedRegion)}`;
      } else {
        window.location.href = "./commercial-rm.html";
      }
      return;
    }

    if (view === "dm") {
      if (selectedRegion) {
        window.location.href = `./commercial-dm.html?region=${encodeURIComponent(selectedRegion)}`;
      } else {
        window.location.href = "./commercial-dm.html";
      }
      return;
    }

    if (view === "sm") {
      if (selectedRegion) {
        window.location.href = `./commercial-portal.html?region=${encodeURIComponent(selectedRegion)}`;
      } else {
        window.location.href = "./commercial-portal.html";
      }
    }
  });
}

function setupRMDistrictActions() {
  const table = document.querySelector("[data-rm-district-table]");
  if (!table) return;

  const selectedRegion = getRegionFromUrl();

  table.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-district-id]");
    if (!trigger) return;

    const districtId = String(trigger.getAttribute("data-district-id") || "").trim();
    if (!districtId) return;

    console.log("[commercial-rm] open district drill-down:", districtId);

    const next = new URL("./commercial-dm.html", window.location.href);
    next.searchParams.set("district", districtId);
    if (selectedRegion) next.searchParams.set("region", selectedRegion);

    window.location.href = next.toString();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setRMHeaderContext();
  setupViewSelector();
  setupRMDistrictActions();
});