// /assets/commercial-kpi-data.js (v2)
// Shared commercial store-level truth adapter
// ✅ Uses approved commercial baseline + latest approved week
// ✅ Falls back to session org/store when URL context is incomplete
// ✅ Uses shared KPI engine
// ✅ One source for KPIs / Shift Insight / Action Plan / Progress
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

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    orgId: cleanString(params.get("org")),
    storeId: cleanString(params.get("store")),
    districtId: cleanString(params.get("district")),
    regionId: cleanString(params.get("region"))
  };
}

export function getCommercialScopeFromUrl() {
  const p = getParams();
  return {
    storeId: p.storeId,
    districtId: p.districtId,
    regionId: p.regionId
  };
}

export function getCommercialSessionContext() {
  const session = readSession() || {};
  const p = getParams();

  const assignedStoreIds = Array.isArray(session.assigned_store_ids)
    ? session.assigned_store_ids.map(cleanString).filter(Boolean)
    : [];

  return {
    session,
    orgId: p.orgId || cleanString(session.orgId),
    role: cleanString(session.role).toUpperCase(),
    storeId: p.storeId || assignedStoreIds[0] || "",
    districtId: p.districtId,
    regionId: p.regionId
  };
}

export async function loadCommercialStoreTruth() {
  const ctx = getCommercialSessionContext();

  const result = {
    ok: false,
    orgId: ctx.orgId,
    role: ctx.role,
    storeId: ctx.storeId,
    districtId: ctx.districtId,
    regionId: ctx.regionId,
    session: ctx.session,
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

  if (!ctx.orgId || !ctx.storeId) {
    return result;
  }

  const baselineStatus = await getStoreBaselineStatus(ctx.orgId, ctx.storeId);
  const latestWeek = await getLatestStoreWeek(ctx.orgId, ctx.storeId);
  const allWeeksRaw = await listStoreWeeks(ctx.orgId, ctx.storeId);

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
  const baselineRows = Array.isArray(activeBaseline?.rows) ? activeBaseline.rows : [];
  const latestWeekRows = Array.isArray(latestWeek?.rows) ? latestWeek.rows : [];
  const previousWeekRows = Array.isArray(previousWeek?.rows) ? previousWeek.rows : [];

  result.baselineRows = baselineRows;
  result.latestWeekRows = latestWeekRows;
  result.previousWeekRows = previousWeekRows;

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
  result.previousWeekKpis = previousWeek ? computeKpisFromRows(previousWeekRows) : null;
  result.ok = true;
  result.state = "live";
  result.message = "Approved baseline and latest approved week are loaded.";

  return result;
}