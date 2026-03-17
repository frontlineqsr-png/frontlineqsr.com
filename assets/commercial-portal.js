// assets/commercial-portal.js (v6)
// Store Manager page logic only
// Shared auth/session/logout is handled by commercial-page-boot.js
// Presentation-ready KPI state for commercial side
// NOTE: This does NOT fake KPI math. It clearly communicates pending commercial data
// until approved baseline + approved weekly upload wiring is added.

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

function setPendingKpiState() {
  const selectedStore = getStoreFromUrl();
  const storeName = selectedStore ? prettyLabel(selectedStore) : "selected store";

  if ($("kpiSalesValue")) $("kpiSalesValue").textContent = "—";
  if ($("kpiTransactionsValue")) $("kpiTransactionsValue").textContent = "—";
  if ($("kpiLaborPctValue")) $("kpiLaborPctValue").textContent = "—";
  if ($("kpiAvgTicketValue")) $("kpiAvgTicketValue").textContent = "—";

  if ($("kpiSalesDelta")) $("kpiSalesDelta").textContent = "Awaiting approved commercial data";
  if ($("kpiTransactionsDelta")) $("kpiTransactionsDelta").textContent = "Awaiting approved commercial data";
  if ($("kpiLaborPctDelta")) $("kpiLaborPctDelta").textContent = "Awaiting approved commercial data";
  if ($("kpiAvgTicketDelta")) $("kpiAvgTicketDelta").textContent = "Awaiting approved commercial data";

  if ($("baselineStatusText")) {
    $("baselineStatusText").textContent =
      `No approved commercial baseline loaded for ${storeName} yet. Once a commercial baseline exists, KPI baseline weekly equivalent should populate here.`;
  }

  if ($("weeklyStatusText")) {
    $("weeklyStatusText").textContent =
      `No approved commercial weekly upload loaded for ${storeName} yet. Once an approved weekly upload exists, latest KPI values should populate here.`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  setSMHeaderContext();
  setupViewSelector();
  setupTabs();
  setPendingKpiState();
});