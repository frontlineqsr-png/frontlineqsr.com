// assets/commercial-portal.js (v8)
// Store Manager page logic only
// Shared auth/session/logout is handled by commercial-page-boot.js
// Reads live commercial baseline + latest week from Firestore
// Uses shared KPI engine and keeps KPI math unchanged

import {
  getStoreBaselineStatus,
  getLatestStoreWeek
} from "./commercial-db.js";

import {
  computeKpisFromRows,
  normalizeBaselineMonthToWeeklyAvg,
  deltaClass,
  fmtMoney,
  fmtNumber,
  fmtPct
} from "./core-kpi-engine.js";

const $ = (id) => document.getElementById(id);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    orgId: String(params.get("org") || "").trim(),
    storeId: String(params.get("store") || "").trim(),
    districtId: String(params.get("district") || "").trim(),
    regionId: String(params.get("region") || "").trim()
  };
}

function getStoreFromUrl() {
  return getParams().storeId;
}

function getDistrictFromUrl() {
  return getParams().districtId;
}

function getRegionFromUrl() {
  return getParams().regionId;
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

function setDelta(id, text, tone = "pending") {
  setText(id, text);
  setClass(id, `kpi-delta ${tone}`);
}

function setSMHeaderContext() {
  const s = readSession();
  const params = getParams();

  const role = String(s?.role || "sm").toUpperCase();
  const orgId = params.orgId || s?.orgId || "N/A";
  const stores = Array.isArray(s?.assigned_store_ids) ? s.assigned_store_ids : [];

  const selectedStore = params.storeId;
  const selectedDistrict = params.districtId;
  const selectedRegion = params.regionId;

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
    const params = getParams();

    if (view === "vp") {
      const next = new URL("./commercial-vp.html", window.location.href);
      if (params.orgId) next.searchParams.set("org", params.orgId);
      window.location.href = next.toString();
      return;
    }

    if (view === "rm") {
      const next = new URL("./commercial-rm.html", window.location.href);
      if (params.orgId) next.searchParams.set("org", params.orgId);
      if (params.regionId) next.searchParams.set("region", params.regionId);
      window.location.href = next.toString();
      return;
    }

    if (view === "dm") {
      const next = new URL("./commercial-dm.html", window.location.href);
      if (params.orgId) next.searchParams.set("org", params.orgId);
      if (params.districtId) next.searchParams.set("district", params.districtId);
      if (params.regionId) next.searchParams.set("region", params.regionId);
      window.location.href = next.toString();
      return;
    }

    if (view === "sm") {
      const next = new URL("./commercial-portal.html", window.location.href);
      if (params.orgId) next.searchParams.set("org", params.orgId);
      if (params.storeId) next.searchParams.set("store", params.storeId);
      if (params.districtId) next.searchParams.set("district", params.districtId);
      if (params.regionId) next.searchParams.set("region", params.regionId);
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

  setDelta("kpiSalesDelta", "Awaiting approved commercial data", "pending");
  setDelta("kpiTransactionsDelta", "Awaiting approved commercial data", "pending");
  setDelta("kpiLaborPctDelta", "Awaiting approved commercial data", "pending");
  setDelta("kpiAvgTicketDelta", "Awaiting approved commercial data", "pending");

  setText(
    "baselineStatusText",
    `No approved commercial baseline loaded for ${storeName} yet. Once a commercial baseline exists, KPI baseline weekly equivalent should populate here.`
  );

  setText(
    "weeklyStatusText",
    `No approved commercial weekly upload loaded for ${storeName} yet. Once an approved weekly upload exists, latest KPI values should populate here.`
  );
}

function applyKpiValues({ baselineWeekly, latestWeekKpis }) {
  const salesDelta = latestWeekKpis.sales - baselineWeekly.sales;
  const transactionsDelta = latestWeekKpis.transactions - baselineWeekly.transactions;
  const laborPctDelta = latestWeekKpis.laborPct - baselineWeekly.laborPct;
  const avgTicketDelta = latestWeekKpis.avgTicket - baselineWeekly.avgTicket;

  setText("kpiSalesValue", fmtMoney(latestWeekKpis.sales));
  setText("kpiTransactionsValue", fmtNumber(latestWeekKpis.transactions));
  setText("kpiLaborPctValue", fmtPct(latestWeekKpis.laborPct));
  setText("kpiAvgTicketValue", fmtMoney(latestWeekKpis.avgTicket));

  setDelta(
    "kpiSalesDelta",
    `${salesDelta >= 0 ? "+" : ""}${fmtMoney(salesDelta)} vs baseline week`,
    deltaClass(salesDelta, "up") || "pending"
  );

  setDelta(
    "kpiTransactionsDelta",
    `${transactionsDelta >= 0 ? "+" : ""}${fmtNumber(transactionsDelta)} vs baseline week`,
    deltaClass(transactionsDelta, "up") || "pending"
  );

  setDelta(
    "kpiLaborPctDelta",
    `${laborPctDelta >= 0 ? "+" : ""}${fmtPct(laborPctDelta)} vs baseline`,
    deltaClass(laborPctDelta, "down") || "pending"
  );

  setDelta(
    "kpiAvgTicketDelta",
    `${avgTicketDelta >= 0 ? "+" : ""}${fmtMoney(avgTicketDelta)} vs baseline`,
    deltaClass(avgTicketDelta, "up") || "pending"
  );
}

async function loadCommercialKpiStatus() {
  const session = readSession();
  const params = getParams();

  const orgId = String(params.orgId || session?.orgId || "").trim();
  const selectedStore = String(params.storeId || "").trim();
  const storeName = selectedStore ? prettyLabel(selectedStore) : "selected store";

  setBasePendingState(storeName);

  if (!orgId || !selectedStore) {
    setText(
      "baselineStatusText",
      "Missing org or selected store context. Select a store to view commercial KPI status."
    );
    return;
  }

  try {
    const status = await getStoreBaselineStatus(orgId, selectedStore);

    if (!status?.activeBaseline) {
      if (status?.pendingBaseline) {
        const label = status.pendingBaseline.label || status.pendingBaseline.year || "Pending baseline";
        const rows = Number(status.pendingBaseline.rowCount || 0);

        setText(
          "baselineStatusText",
          `Pending baseline found: ${label}. Row count: ${rows}. Admin approval is still required before KPI baseline weekly equivalent can be used here.`
        );

        setDelta("kpiSalesDelta", "Pending baseline approval", "pending");
        setDelta("kpiTransactionsDelta", "Pending baseline approval", "pending");
        setDelta("kpiLaborPctDelta", "Pending baseline approval", "pending");
        setDelta("kpiAvgTicketDelta", "Pending baseline approval", "pending");
      }
      return;
    }

    const activeBaseline = status.activeBaseline;
    const baselineRows = Array.isArray(activeBaseline.rows) ? activeBaseline.rows : [];
    const baselineKpis = computeKpisFromRows(baselineRows);
    const baselineWeekly = normalizeBaselineMonthToWeeklyAvg(baselineKpis);

    const latestWeek = await getLatestStoreWeek(orgId, selectedStore);

    const baselineLabel = activeBaseline.label || activeBaseline.year || "Approved baseline";
    const baselineRowCount = Number(activeBaseline.rowCount || 0);

    setText(
      "baselineStatusText",
      `Approved baseline loaded: ${baselineLabel}. Row count: ${baselineRowCount}. Baseline weekly equivalent is being used as the KPI truth source.`
    );

    if (!latestWeek) {
      setText(
        "weeklyStatusText",
        `No approved weekly upload loaded for ${storeName} yet. Upload a weekly CSV to populate live KPI comparison.`
      );

      setDelta("kpiSalesDelta", "Approved baseline on file", "good");
      setDelta("kpiTransactionsDelta", "Approved baseline on file", "good");
      setDelta("kpiLaborPctDelta", "Approved baseline on file", "good");
      setDelta("kpiAvgTicketDelta", "Approved baseline on file", "good");
      return;
    }

    const latestWeekRows = Array.isArray(latestWeek.rows) ? latestWeek.rows : [];
    const latestWeekKpis = computeKpisFromRows(latestWeekRows);

    applyKpiValues({
      baselineWeekly,
      latestWeekKpis
    });

    setText(
      "weeklyStatusText",
      `Latest approved week loaded: ${latestWeek.weekStart || latestWeek.id}. Row count: ${Number(latestWeek.rowCount || 0)}. KPI cards now compare this week against the approved baseline weekly equivalent.`
    );
  } catch (e) {
    console.error("[commercial-portal] loadCommercialKpiStatus failed:", e);
    setText("baselineStatusText", `Unable to load baseline status for ${storeName}.`);
    setText("weeklyStatusText", "Commercial weekly upload status unavailable right now.");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  setSMHeaderContext();
  setupViewSelector();
  setupTabs();
  await loadCommercialKpiStatus();
});