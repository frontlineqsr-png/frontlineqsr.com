// assets/commercial-dm.js (v3)
// District Manager page logic
// Shared auth/session/logout is handled by commercial-page-boot.js

const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function getDistrictFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("district") || "").trim();
}

function getRegionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("region") || "").trim();
}

function prettyLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function setDMHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "dm").toUpperCase();
  const orgId = s.orgId || "N/A";
  const districts = Array.isArray(s.assigned_district_ids) ? s.assigned_district_ids : [];
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  const extra = $("dmContext");
  if (extra) {
    extra.textContent =
      `Org: ${orgId} | Role: ${role} | District Scope: ${
        selectedDistrict
          ? prettyLabel(selectedDistrict)
          : (districts.length ? districts.join(", ") : "Assigned district access")
      }`;
  }

  const activeDistrict = $("activeDistrict");
  if (activeDistrict) {
    const regionText = selectedRegion ? ` | Region: ${prettyLabel(selectedRegion)}` : "";
    activeDistrict.textContent = selectedDistrict
      ? `Selected District: ${prettyLabel(selectedDistrict)}${regionText}`
      : `Selected District: All assigned districts${regionText}`;
  }
}

function setupDMTableActions() {
  const table = document.querySelector("[data-dm-store-table]");
  if (!table) return;

  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  table.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-store-id]");
    if (!trigger) return;

    const storeId = String(trigger.getAttribute("data-store-id") || "").trim();
    if (!storeId) return;

    console.log("[commercial-dm] open store drill-down:", storeId);

    const next = new URL("./commercial-portal.html", window.location.href);
    next.searchParams.set("store", storeId);
    if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
    if (selectedRegion) next.searchParams.set("region", selectedRegion);

    window.location.href = next.toString();
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