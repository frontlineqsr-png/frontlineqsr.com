// /assets/commercial-kpi-data.js (v1)
// Shared commercial store-level truth adapter
// ✅ Uses approved commercial baseline + latest approved week
// ✅ Uses shared KPI engine
// ✅ No KPI math changes
// ✅ One source for KPIs / Shift Insight / Action Plan / Progress

import {
  getStoreBaselineStatus,
  getLatestStoreWeek,
  listStoreWeeks
} from "./commercial-db.js";

import {
  computeKpisFromRows,
  normalizeBaselineMonthToWeeklyAvg
} from "./core-kpi-engine.js";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function cleanString(v) {
  return String(v || "").trim();
}

function getStoreFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return cleanString(params.get("store"));
}

function getDistrictFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return cleanString(params.get("district"));
}

function getRegionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return cleanString(params.get("region"));
}

export function getCommercialScopeFromUrl() {
  return {
    storeId: getStoreFromUrl(),
    districtId: getDistrictFromUrl(),
    regionId: getRegionFromUrl()
  };
}

export function getCommercialSessionContext() {
  const session = readSession();
  return {
    session,
    orgId: cleanString(session?.orgId),
    role: cleanString(session?.role).toUpperCase()
  };
}

export async function loadCommercialStoreTruth() {
  const { orgId, role, session } = getCommercialSessionContext();
  const { storeId, districtId, regionId } = getCommercialScopeFromUrl();

  const result = {
    ok: false,
    orgId,
    role,
    storeId,
    districtId,
    regionId,
    session,
    baselineStatus: null,
    latestWeek: null,
    allWeeks: [],
    baselineRows: [],
    latestWeekRows: [],
    baselineMonthKpis: null,
    baselineWeeklyKpis: null,
    latestWeekKpis: null,
    state: "missing_context",
    message: "Missing org or store context."
  };

  if (!orgId || !storeId) {
    return result;
  }

  const baselineStatus = await getStoreBaselineStatus(orgId, storeId);
  const latestWeek = await getLatestStoreWeek(orgId, storeId);
  const allWeeks = await listStoreWeeks(orgId, storeId);

  result.baselineStatus = baselineStatus || null;
  result.latestWeek = latestWeek || null;
  result.allWeeks = Array.isArray(allWeeks) ? allWeeks : [];

  const activeBaseline = baselineStatus?.activeBaseline || null;
  const baselineRows = Array.isArray(activeBaseline?.rows) ? activeBaseline.rows : [];
  const latestWeekRows = Array.isArray(latestWeek?.rows) ? latestWeek.rows : [];

  result.baselineRows = baselineRows;
  result.latestWeekRows = latestWeekRows;

  if (!activeBaseline && baselineStatus?.pendingBaseline) {
    result.state = "pending_baseline";
    result.message = "Pending baseline exists but is not approved yet.";
    return result;
  }

  if (!activeBaseline) {
    result.state = "missing_baseline";
    result.message = "No approved baseline found.";
    return result;
  }

  result.baselineMonthKpis = computeKpisFromRows(baselineRows);
  result.baselineWeeklyKpis = normalizeBaselineMonthToWeeklyAvg(result.baselineMonthKpis);

  if (!latestWeek) {
    result.ok = true;
    result.state = "baseline_only";
    result.message = "Approved baseline found, but no approved weekly upload exists yet.";
    return result;
  }

  result.latestWeekKpis = computeKpisFromRows(latestWeekRows);
  result.ok = true;
  result.state = "live";
  result.message = "Approved baseline and latest approved week are loaded.";

  return result;
}