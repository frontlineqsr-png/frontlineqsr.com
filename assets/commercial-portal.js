// assets/commercial-portal.js (v7)
// Store Manager page logic only
// Shared auth/session/logout is handled by commercial-page-boot.js
// Reads live commercial baseline status from Firestore
// Does NOT change KPI math

import { getStoreBaselineStatus } from "./commercial-db.js";

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

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setClass(id, className) {
  const el = $(id);
  if (el) el.className = className;
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

function setBasePendingState(storeName) {
  setText("kpiSalesValue", "—");
  setText("kpiTransactionsValue", "—");
  setText("kpiLaborPctValue", "—");
  setText("kpiAvgTicketValue", "—");

  setText("kpiSalesDelta", "Awaiting approved commercial data");
  setText("kpiTransactionsDelta", "Awaiting approved commercial data");
  setText("kpiLaborPctDelta", "Awaiting approved commercial data");
  setText("kpiAvgTicketDelta", "Awaiting approved commercial data");

  setClass("kpiSalesDelta", "kpi-delta pending");
  setClass("kpiTransactionsDelta", "kpi-delta pending");
  setClass("kpiLaborPctDelta", "kpi-delta pending");
  setClass("kpiAvgTicketDelta", "kpi-delta pending");

  setText(
    "baselineStatusText",
    `No approved commercial baseline loaded for ${storeName} yet. Once a commercial baseline exists, KPI baseline weekly equivalent should populate here.`
  );

  setText(
    "weeklyStatusText",
    `No approved commercial weekly upload loaded for ${storeName} yet. Once an approved weekly upload exists, latest KPI values should populate here.`
  );
}

async function loadCommercialKpiStatus() {
  const session = readSession();
  const orgId = String(session?.orgId || "").trim();
  const selectedStore = getStoreFromUrl();
  const storeName = selectedStore ? prettyLabel(selectedStore) : "selected store";

  setBasePendingState(storeName);

  if (!orgId || !selectedStore) {
    setText(
      "baselineStatusText",
      `Missing org or selected store context. Select a store to view commercial KPI status.`
    );
    return;
  }

  try {
    const status = await getStoreBaselineStatus(orgId, selectedStore);

    if (status?.activeBaseline) {
      const label = status.activeBaseline.label || status.activeBaseline.year || "Approved baseline";
      const rows = Number(status.activeBaseline.rowCount || 0);

      setText(
        "baselineStatusText",
        `Approved baseline loaded: ${label}. Row count: ${rows}. Weekly KPI comparison should use this store baseline as the truth source.`
      );

      setText("kpiSalesDelta", "Approved baseline on file");
      setText("kpiTransactionsDelta", "Approved baseline on file");
      setText("kpiLaborPctDelta", "Approved baseline on file");
      setText("kpiAvgTicketDelta", "Approved baseline on file");

      setClass("kpiSalesDelta", "kpi-delta good");
      setClass("kpiTransactionsDelta", "kpi-delta good");
      setClass("kpiLaborPctDelta", "kpi-delta good");
      setClass("kpiAvgTicketDelta", "kpi-delta good");
    } else if (status?.pendingBaseline) {
      const label = status.pendingBaseline.label || status.pendingBaseline.year || "Pending baseline";
      const rows = Number(status.pendingBaseline.rowCount || 0);

      setText(
        "baselineStatusText",
        `Pending baseline found: ${label}. Row count: ${rows}. Admin approval is still required before KPI baseline weekly equivalent can be used here.`
      );

      setText("kpiSalesDelta", "Pending baseline approval");
      setText("kpiTransactionsDelta", "Pending baseline approval");
      setText("kpiLaborPctDelta", "Pending baseline approval");
      setText("kpiAvgTicketDelta", "Pending baseline approval");

      setClass("kpiSalesDelta", "kpi-delta pending");
      setClass("kpiTransactionsDelta", "kpi-delta pending");
      setClass("kpiLaborPctDelta", "kpi-delta pending");
      setClass("kpiAvgTicketDelta", "kpi-delta pending");
    }

    setText(
      "weeklyStatusText",
      `Weekly commercial upload wiring is the next live-data step. Default behavior should use the latest approved week, with ability to compare to other approved weeks later.`
    );
  } catch (e) {
    console.error("[commercial-portal] loadCommercialKpiStatus failed:", e);
    setText(
      "baselineStatusText",
      `Unable to load baseline status for ${storeName}.`
    );
    setText(
      "weeklyStatusText",
      `Commercial weekly upload status unavailable right now.`
    );
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  setSMHeaderContext();
  setupViewSelector();
  setupTabs();
  await loadCommercialKpiStatus();
});