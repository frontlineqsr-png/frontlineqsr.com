// assets/commercial-portal.js (v5)
// Store Manager page logic only
// Shared auth/session/logout is handled by commercial-page-boot.js

const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function getStoreFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("store") || "").trim();
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

function setSMHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "sm").toUpperCase();
  const orgId = s.orgId || "N/A";
  const stores = Array.isArray(s.assigned_store_ids) ? s.assigned_store_ids : [];

  const selectedStore = getStoreFromUrl();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  const extra = $("smContext");
  if (extra) {
    extra.textContent =
      `Org: ${orgId} | Role: ${role} | Store Scope: ${
        selectedStore
          ? prettyLabel(selectedStore)
          : (stores.length ? stores.join(", ") : "Assigned store access")
      }`;
  }

  const activeStore = $("activeStore");
  if (activeStore) {
    const districtText = selectedDistrict ? ` | District: ${prettyLabel(selectedDistrict)}` : "";
    const regionText = selectedRegion ? ` | Region: ${prettyLabel(selectedRegion)}` : "";

    activeStore.textContent = selectedStore
      ? `Selected Store: ${prettyLabel(selectedStore)}${districtText}${regionText}`
      : `Selected Store: All assigned stores${districtText}${regionText}`;
  }
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();
    const selectedStore = getStoreFromUrl();
    const selectedDistrict = getDistrictFromUrl();
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
      const next = new URL("./commercial-dm.html", window.location.href);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      window.location.href = next.toString();
      return;
    }

    if (view === "sm") {
      const next = new URL("./commercial-portal.html", window.location.href);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      window.location.href = next.toString();
    }
  });
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (!tab) return;

      buttons.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");

      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add("active");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setSMHeaderContext();
  setupViewSelector();
  setupTabs();
});