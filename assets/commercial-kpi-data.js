// /assets/commercial-kpi-data.js (v2 FIXED)
// Shared commercial store-level truth adapter
// ✅ Standardized state = "ready"
// ✅ Fixes wiring for Shift / Action / Progress
// 🚫 No KPI math changes

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
    previousWeek: null,
    previousWeekRows: [],
    previousWeekKpis: null,
    state: "missing_context",
    message: "Missing org or store context."
  };

  if (!orgId || !storeId) {
    return result;
  }

  const baselineStatus = await getStoreBaselineStatus(orgId, storeId);
  const latestWeek = await getLatestStoreWeek(orgId, storeId);
  const allWeeksRaw = await listStoreWeeks(orgId, storeId);

  const allWeeks = Array.isArray(allWeeksRaw)
    ? [...allWeeksRaw].sort((a, b) =>
        String(a.weekStart || "").localeCompare(String(b.weekStart || ""))
      )
    : [];

  const previousWeek =
    allWeeks.length >= 2 ? allWeeks[allWeeks.length - 2] : null;

  result.baselineStatus = baselineStatus || null;
  result.latestWeek = latestWeek || null;
  result.allWeeks = allWeeks;
  result.previousWeek = previousWeek || null;

  const activeBaseline = baselineStatus?.activeBaseline || null;

  if (!activeBaseline && baselineStatus?.pendingBaseline) {
    result.state = "pending_baseline";
    return result;
  }

  if (!activeBaseline) {
    result.state = "missing_baseline";
    return result;
  }

  const baselineRows = Array.isArray(activeBaseline?.rows)
    ? activeBaseline.rows
    : [];

  const latestWeekRows = Array.isArray(latestWeek?.rows)
    ? latestWeek.rows
    : [];

  const previousWeekRows = Array.isArray(previousWeek?.rows)
    ? previousWeek.rows
    : [];

  result.baselineRows = baselineRows;
  result.latestWeekRows = latestWeekRows;
  result.previousWeekRows = previousWeekRows;

  result.baselineMonthKpis = computeKpisFromRows(baselineRows);
  result.baselineWeeklyKpis =
    normalizeBaselineMonthToWeeklyAvg(result.baselineMonthKpis);

  if (!latestWeek) {
    result.ok = true;
    result.state = "baseline_only";
    return result;
  }

  result.latestWeekKpis = computeKpisFromRows(latestWeekRows);
  result.previousWeekKpis = previousWeek
    ? computeKpisFromRows(previousWeekRows)
    : null;

  result.ok = true;
  result.state = "ready"; // ✅ THIS IS THE FIX

  return result;
}