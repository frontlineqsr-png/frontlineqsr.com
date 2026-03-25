// /assets/commercial-portal.js (v12)
// Store Manager portal logic
// Shared auth/session is handled by commercial-page-boot.js
// Reads live commercial baseline + approved weekly truth from Firestore
// Uses shared KPI engine and keeps KPI math unchanged
// ✅ Tabs route to the real live commercial pages
// ✅ KPI remains on portal page
// ✅ Uses approved weekly truth only
// ✅ Shows pending approval messaging when weekly upload exists but is not approved
// ✅ Adds Weekly Upload tab route
// ✅ Adds region / district / store switching
// ✅ DM and above can move store scope without snapping back
// ✅ Preserves scoped navigation across views
// 🚫 No KPI math changes

import {
  getStoreBaselineStatus,
  getStoreWeekStatus,
  listStores
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

/* =========================================================
   Session / params
========================================================= */

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

function normalizeId(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
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

function scopeMsg(text, isErr = false) {
  const el = $("scopeMsg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isErr ? "#b91c1c" : "#065f46";
}

/* =========================================================
   Scope helpers
========================================================= */

let ALL_STORES = [];

function uniqueValues(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function currentScope() {
  const params = getParams();
  const session = readSession() || {};
  return {
    orgId: String(params.orgId || session.orgId || "").trim(),
    regionId: String($("regionSelector")?.value || params.regionId || "").trim(),
    districtId: String($("districtSelector")?.value || params.districtId || "").trim(),
    storeId: String($("storeSelector")?.value || params.storeId || "").trim()
  };
}

function updateUrlFromScope(scope = currentScope()) {
  const next = new URL(window.location.href);

  if (scope.orgId) next.searchParams.set("org", scope.orgId);
  else next.searchParams.delete("org");

  if (scope.regionId) next.searchParams.set("region", scope.regionId);
  else next.searchParams.delete("region");

  if (scope.districtId) next.searchParams.set("district", scope.districtId);
  else next.searchParams.delete("district");

  if (scope.storeId) next.searchParams.set("store", scope.storeId);
  else next.searchParams.delete("store");

  window.history.replaceState({}, "", next.toString());
}

function buildScopedUrl(path, scope = currentScope()) {
  const next = new URL(path, window.location.href);

  if (scope.orgId) next.searchParams.set("org", scope.orgId);
  if (scope.regionId) next.searchParams.set("region", scope.regionId);
  if (scope.districtId) next.searchParams.set("district", scope.districtId);
  if (scope.storeId) next.searchParams.set("store", scope.storeId);

  return next.toString();
}

function fillRegionSelector(selected = "") {
  const regions = uniqueValues(
    ALL_STORES.map((s) => String(s.regionId || "").trim()).filter(Boolean)
  ).sort((a, b) => a.localeCompare(b));

  const el = $("regionSelector");
  if (!el) return;

  el.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Select region";
  el.appendChild(blank);

  regions.forEach((regionId) => {
    const opt = document.createElement("option");
    opt.value = regionId;
    opt.textContent = prettyLabel(regionId);
    if (regionId === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

function fillDistrictSelector(regionId = "", selected = "") {
  const districts = uniqueValues(
    ALL_STORES
      .filter((s) => !regionId || String(s.regionId || "").trim() === regionId)
      .map((s) => String(s.districtId || "").trim())
      .filter(Boolean)
  ).sort((a, b) => a.localeCompare(b));

  const el = $("districtSelector");
  if (!el) return;

  el.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Select district";
  el.appendChild(blank);

  districts.forEach((districtId) => {
    const opt = document.createElement("option");
    opt.value = districtId;
    opt.textContent = prettyLabel(districtId);
    if (districtId === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

function fillStoreSelector(regionId = "", districtId = "", selected = "") {
  const stores = ALL_STORES
    .filter((s) => !regionId || String(s.regionId || "").trim() === regionId)
    .filter((s) => !districtId || String(s.districtId || "").trim() === districtId)
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

  const el = $("storeSelector");
  if (!el) return;

  el.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Select store";
  el.appendChild(blank);

  stores.forEach((store) => {
    const opt = document.createElement("option");
    opt.value = String(store.id || "").trim();
    opt.textContent = prettyLabel(store.name || store.id);
    if (String(store.id || "").trim() === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

async function setupScopeSelectors() {
  const session = readSession() || {};
  const params = getParams();
  const orgId = String(params.orgId || session.orgId || "").trim();

  if (!orgId) {
    scopeMsg("Missing org context.", true);
    return;
  }

  const allStores = await listStores(orgId);
  const activeStores = (allStores || []).filter((s) => s.active !== false);

  const role = String(session.role || "sm").toLowerCase();
  const assignedStoreIds = Array.isArray(session.assigned_store_ids) ? session.assigned_store_ids.map((x) => String(x).trim()) : [];
  const assignedDistrictIds = Array.isArray(session.assigned_district_ids) ? session.assigned_district_ids.map((x) => String(x).trim()) : [];
  const assignedRegionIds = Array.isArray(session.assigned_region_ids) ? session.assigned_region_ids.map((x) => String(x).trim()) : [];

  let allowed = [...activeStores];

  if (role === "sm" && assignedStoreIds.length) {
    allowed = allowed.filter((s) => assignedStoreIds.includes(String(s.id || "").trim()));
  } else if (role === "dm") {
    if (assignedStoreIds.length) {
      allowed = allowed.filter((s) => assignedStoreIds.includes(String(s.id || "").trim()));
    } else if (assignedDistrictIds.length) {
      allowed = allowed.filter((s) => assignedDistrictIds.includes(String(s.districtId || "").trim()));
    }
  } else if (role === "rm" && assignedRegionIds.length) {
    allowed = allowed.filter((s) => assignedRegionIds.includes(String(s.regionId || "").trim()));
  }

  ALL_STORES = allowed;

  if (!ALL_STORES.length) {
    scopeMsg("No active stores available in current scope.", true);
    return;
  }

  const defaultRegion =
    params.regionId ||
    (role === "rm" && assignedRegionIds[0]) ||
    String(ALL_STORES[0]?.regionId || "").trim();

  fillRegionSelector(defaultRegion);

  const defaultDistrict =
    params.districtId ||
    (role === "dm" && assignedDistrictIds[0]) ||
    String(
      ALL_STORES.find((s) => String(s.regionId || "").trim() === defaultRegion)?.districtId || ""
    ).trim();

  fillDistrictSelector(defaultRegion, defaultDistrict);

  const defaultStore =
    params.storeId ||
    (role === "sm" && assignedStoreIds[0]) ||
    String(
      ALL_STORES.find(
        (s) =>
          String(s.regionId || "").trim() === defaultRegion &&
          String(s.districtId || "").trim() === defaultDistrict
      )?.id || ""
    ).trim();

  fillStoreSelector(defaultRegion, defaultDistrict, defaultStore);

  updateUrlFromScope({
    orgId,
    regionId: String($("regionSelector")?.value || "").trim(),
    districtId: String($("districtSelector")?.value || "").trim(),
    storeId: String($("storeSelector")?.value || "").trim()
  });

  scopeMsg(`✅ Scope loaded. ${ALL_STORES.length} active store(s) available.`);

  $("regionSelector")?.addEventListener("change", async () => {
    const regionId = String($("regionSelector")?.value || "").trim();

    const firstDistrict = String(
      ALL_STORES.find((s) => String(s.regionId || "").trim() === regionId)?.districtId || ""
    ).trim();

    fillDistrictSelector(regionId, firstDistrict);

    const firstStore = String(
      ALL_STORES.find(
        (s) =>
          String(s.regionId || "").trim() === regionId &&
          String(s.districtId || "").trim() === firstDistrict
      )?.id || ""
    ).trim();

    fillStoreSelector(regionId, firstDistrict, firstStore);

    updateUrlFromScope({
      orgId,
      regionId,
      districtId: String($("districtSelector")?.value || "").trim(),
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setSMHeaderContext();
    await loadCommercialKpiStatus();
  });

  $("districtSelector")?.addEventListener("change", async () => {
    const regionId = String($("regionSelector")?.value || "").trim();
    const districtId = String($("districtSelector")?.value || "").trim();

    const firstStore = String(
      ALL_STORES.find(
        (s) =>
          String(s.regionId || "").trim() === regionId &&
          String(s.districtId || "").trim() === districtId
      )?.id || ""
    ).trim();

    fillStoreSelector(regionId, districtId, firstStore);

    updateUrlFromScope({
      orgId,
      regionId,
      districtId,
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setSMHeaderContext();
    await loadCommercialKpiStatus();
  });

  $("storeSelector")?.addEventListener("change", async () => {
    updateUrlFromScope({
      orgId,
      regionId: String($("regionSelector")?.value || "").trim(),
      districtId: String($("districtSelector")?.value || "").trim(),
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setSMHeaderContext();
    await loadCommercialKpiStatus();
  });
}

/* =========================================================
   Header / nav / tabs
========================================================= */

function setSMHeaderContext() {
  const s = readSession();
  const scope = currentScope();

  const role = String(s?.role || "sm").toUpperCase();
  const orgId = scope.orgId || s?.orgId || "N/A";

  const extra = $("smContext");
  if (extra) {
    extra.textContent =
      `Org: ${orgId} | Role: ${role} | Store Scope: ${
        scope.storeId ? prettyLabel(scope.storeId) : "Select a store"
      }`;
  }

  const activeStore = $("activeStore");
  if (activeStore) {
    const districtText = scope.districtId ? ` | District: ${prettyLabel(scope.districtId)}` : "";
    const regionText = scope.regionId ? ` | Region: ${prettyLabel(scope.regionId)}` : "";

    activeStore.textContent = scope.storeId
      ? `Selected Store: ${prettyLabel(scope.storeId)}${districtText}${regionText}`
      : `Selected Store: None selected${districtText}${regionText}`;
  }

  const sessionInfo = $("sessionInfo");
  if (sessionInfo) {
    sessionInfo.textContent = `Signed in as: ${s?.email || "Unknown user"}`;
  }
}

function setupLogout() {
  $("logoutBtn")?.addEventListener("click", () => {
    try {
      localStorage.removeItem("FLQSR_COMM_SESSION");
    } catch {}
    window.location.href = "./commercial-login.html";
  });
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      window.location.href = buildScopedUrl("./commercial-vp.html");
      return;
    }

    if (view === "rm") {
      window.location.href = buildScopedUrl("./commercial-rm.html");
      return;
    }

    if (view === "dm") {
      window.location.href = buildScopedUrl("./commercial-dm.html");
      return;
    }

    if (view === "sm") {
      window.location.href = buildScopedUrl("./commercial-portal.html");
    }
  });
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = String(btn.dataset.tab || "").trim().toLowerCase();
      if (!tab) return;

      if (tab === "kpis" || tab === "kpi") {
        window.location.href = buildScopedUrl("./commercial-portal.html");
        return;
      }

      if (tab === "weekly" || tab === "weekly-upload" || tab === "weeklyupload") {
        window.location.href = buildScopedUrl("./commercial-weekly-upload.html");
        return;
      }

      if (tab === "shift" || tab === "shift-insight" || tab === "shiftinsight") {
        window.location.href = buildScopedUrl("./commercial-shift-insight.html");
        return;
      }

      if (tab === "action" || tab === "action-plan" || tab === "actionplan") {
        window.location.href = buildScopedUrl("./commercial-action-plan.html");
        return;
      }

      if (tab === "progress") {
        window.location.href = buildScopedUrl("./commercial-progress.html");
      }
    });
  });
}

/* =========================================================
   KPI state
========================================================= */

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

/* =========================================================
   Data load
========================================================= */

async function loadCommercialKpiStatus() {
  const session = readSession();
  const scope = currentScope();

  const orgId = String(scope.orgId || session?.orgId || "").trim();
  const selectedStore = String(scope.storeId || "").trim();
  const storeName = selectedStore ? prettyLabel(selectedStore) : "selected store";

  setBasePendingState(storeName);

  if (!orgId || !selectedStore) {
    setText(
      "baselineStatusText",
      "Missing org or selected store context. Select a store to view commercial KPI status."
    );
    setText(
      "weeklyStatusText",
      "Select a store to load approved weekly truth."
    );
    return;
  }

  try {
    const baselineStatus = await getStoreBaselineStatus(orgId, selectedStore);

    if (!baselineStatus?.activeBaseline) {
      if (baselineStatus?.pendingBaseline) {
        const label = baselineStatus.pendingBaseline.label || baselineStatus.pendingBaseline.year || "Pending baseline";
        const rows = Number(baselineStatus.pendingBaseline.rowCount || 0);

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

    const activeBaseline = baselineStatus.activeBaseline;
    const baselineRows = Array.isArray(activeBaseline.rows) ? activeBaseline.rows : [];
    const baselineKpis = computeKpisFromRows(baselineRows);
    const baselineWeekly = normalizeBaselineMonthToWeeklyAvg(baselineKpis);

    const baselineLabel = activeBaseline.label || activeBaseline.year || "Approved baseline";
    const baselineRowCount = Number(activeBaseline.rowCount || 0);

    setText(
      "baselineStatusText",
      `Approved baseline loaded: ${baselineLabel}. Row count: ${baselineRowCount}. Baseline weekly equivalent is being used as the KPI truth source.`
    );

    const weekStatus = await getStoreWeekStatus(orgId, selectedStore);
    const latestApprovedWeek = weekStatus?.latestApprovedWeek || null;
    const pendingWeek = weekStatus?.pendingWeek || null;

    if (!latestApprovedWeek && pendingWeek) {
      setText(
        "weeklyStatusText",
        `Weekly upload is pending approval: ${pendingWeek.weekStart || pendingWeek.id}. Row count: ${Number(pendingWeek.rowCount || 0)}. KPI cards will update only after district approval.`
      );

      setDelta("kpiSalesDelta", "Pending weekly approval", "pending");
      setDelta("kpiTransactionsDelta", "Pending weekly approval", "pending");
      setDelta("kpiLaborPctDelta", "Pending weekly approval", "pending");
      setDelta("kpiAvgTicketDelta", "Pending weekly approval", "pending");
      return;
    }

    if (!latestApprovedWeek) {
      setText(
        "weeklyStatusText",
        `No approved weekly upload loaded for ${storeName} yet. Upload the next required weekly CSV to begin live KPI comparison.`
      );

      setDelta("kpiSalesDelta", "Approved baseline on file", "good");
      setDelta("kpiTransactionsDelta", "Approved baseline on file", "good");
      setDelta("kpiLaborPctDelta", "Approved baseline on file", "good");
      setDelta("kpiAvgTicketDelta", "Approved baseline on file", "good");
      return;
    }

    const latestWeekRows = Array.isArray(latestApprovedWeek.rows) ? latestApprovedWeek.rows : [];
    const latestWeekKpis = computeKpisFromRows(latestWeekRows);

    applyKpiValues({
      baselineWeekly,
      latestWeekKpis
    });

    if (pendingWeek) {
      setText(
        "weeklyStatusText",
        `Latest approved week loaded: ${latestApprovedWeek.weekStart || latestApprovedWeek.id}. A newer weekly upload is currently pending approval: ${pendingWeek.weekStart || pendingWeek.id}. KPI cards remain locked to approved truth until approval is completed.`
      );
      return;
    }

    setText(
      "weeklyStatusText",
      `Latest approved week loaded: ${latestApprovedWeek.weekStart || latestApprovedWeek.id}. Row count: ${Number(latestApprovedWeek.rowCount || 0)}. KPI cards now compare this week against the approved baseline weekly equivalent.`
    );
  } catch (e) {
    console.error("[commercial-portal] loadCommercialKpiStatus failed:", e);
    setText("baselineStatusText", `Unable to load baseline status for ${storeName}.`);
    setText("weeklyStatusText", "Commercial weekly upload status unavailable right now.");
  }
}

/* =========================================================
   Init
========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  setupLogout();
  setupViewSelector();
  setupTabs();
  await setupScopeSelectors();
  setSMHeaderContext();
  await loadCommercialKpiStatus();
});