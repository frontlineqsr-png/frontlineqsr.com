// /assets/commercial-rollup-data.js
// Shared commercial rollup adapter for DM / RM / VP
// ✅ Reuses store-level approved truth
// ✅ Aggregates baseline weekly equivalent + latest approved week + previous approved week
// ✅ Supports store / district / region / org rollups
// 🚫 No KPI math changes

import {
  listStores,
  getStoreBaselineStatus,
  listStoreWeeks
} from "./commercial-db.js";

import {
  computeKpisFromRows,
  normalizeBaselineMonthToWeeklyAvg
} from "./core-kpi-engine.js";

/* =========================================================
   Helpers
========================================================= */

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

function sortByWeekAsc(weeks) {
  return [...(weeks || [])].sort((a, b) =>
    String(a.weekStart || "").localeCompare(String(b.weekStart || ""))
  );
}

function sortByWeekDesc(weeks) {
  return [...(weeks || [])].sort((a, b) =>
    String(b.weekStart || "").localeCompare(String(a.weekStart || ""))
  );
}

function sumNumber(values) {
  return values.reduce((sum, v) => sum + (isFinite(v) ? Number(v) : 0), 0);
}

function weightedAverage(items, valueKey, weightKey) {
  let weighted = 0;
  let weightSum = 0;

  for (const item of (items || [])) {
    const value = Number(item?.[valueKey]);
    const weight = Number(item?.[weightKey]);

    if (isFinite(value) && isFinite(weight) && weight > 0) {
      weighted += value * weight;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? (weighted / weightSum) : null;
}

function computeAvgTicketFromTotals(sales, transactions) {
  return transactions > 0 ? (sales / transactions) : null;
}

function aggregateKpis(kpiList) {
  const sales = sumNumber((kpiList || []).map(k => k?.sales));
  const transactions = sumNumber((kpiList || []).map(k => k?.transactions));
  const laborDollars = sumNumber((kpiList || []).map(k => k?.laborDollars));

  let laborPct = null;
  if (sales > 0 && laborDollars > 0) {
    laborPct = (laborDollars / sales) * 100;
  } else {
    laborPct = weightedAverage(kpiList, "laborPct", "sales");
  }

  const avgTicket = computeAvgTicketFromTotals(sales, transactions);

  return {
    sales,
    transactions,
    laborDollars: laborDollars || null,
    laborPct,
    avgTicket
  };
}

function pickLatestWeek(weeks) {
  const sorted = sortByWeekDesc(weeks);
  return sorted.length ? sorted[0] : null;
}

function pickPreviousWeek(weeks) {
  const sorted = sortByWeekDesc(weeks);
  return sorted.length >= 2 ? sorted[1] : null;
}

function getCommercialSessionContext() {
  const session = readSession() || {};
  const p = getParams();

  return {
    session,
    orgId: p.orgId || cleanString(session.orgId),
    role: cleanString(session.role).toUpperCase(),
    storeId: p.storeId,
    districtId: p.districtId,
    regionId: p.regionId
  };
}

function storeMatchesScope(store, scope) {
  if (!store) return false;

  const storeId = cleanString(store.id);
  const districtId = cleanString(store.districtId);
  const regionId = cleanString(store.regionId);

  if (scope.level === "store") {
    return storeId === cleanString(scope.storeId);
  }

  if (scope.level === "district") {
    return districtId === cleanString(scope.districtId);
  }

  if (scope.level === "region") {
    return regionId === cleanString(scope.regionId);
  }

  return true;
}

function inferScope(ctx) {
  if (ctx.storeId) {
    return { level: "store", storeId: ctx.storeId };
  }
  if (ctx.districtId) {
    return { level: "district", districtId: ctx.districtId };
  }
  if (ctx.regionId) {
    return { level: "region", regionId: ctx.regionId };
  }
  return { level: "org" };
}

function childKeyForLevel(level, store) {
  if (level === "district") return cleanString(store.id);
  if (level === "region") return cleanString(store.districtId) || "unassigned_district";
  if (level === "org") return cleanString(store.regionId) || "unassigned_region";
  return cleanString(store.id);
}

function childLabelForLevel(level, store) {
  if (level === "district") return cleanString(store.name) || cleanString(store.id);
  if (level === "region") return cleanString(store.districtId) || "Unassigned District";
  if (level === "org") return cleanString(store.regionId) || "Unassigned Region";
  return cleanString(store.name) || cleanString(store.id);
}

/* =========================================================
   Per-store approved truth
========================================================= */

async function loadStoreApprovedTruth(orgId, store) {
  const storeId = cleanString(store?.id);

  const out = {
    ok: false,
    orgId,
    storeId,
    storeName: cleanString(store?.name),
    districtId: cleanString(store?.districtId),
    regionId: cleanString(store?.regionId),
    baselineStatus: null,
    latestWeek: null,
    previousWeek: null,
    baselineRows: [],
    latestWeekRows: [],
    previousWeekRows: [],
    baselineMonthKpis: null,
    baselineWeeklyKpis: null,
    latestWeekKpis: null,
    previousWeekKpis: null,
    allWeeks: [],
    state: "missing_baseline"
  };

  if (!orgId || !storeId) return out;
  if (store?.active === false || store?.archived === true) {
    out.state = "inactive_store";
    return out;
  }

  const baselineStatus = await getStoreBaselineStatus(orgId, storeId);
  const allWeeksRaw = await listStoreWeeks(orgId, storeId);
  const allWeeks = sortByWeekAsc(allWeeksRaw);

  const latestWeek = pickLatestWeek(allWeeks);
  const previousWeek = pickPreviousWeek(allWeeks);

  out.baselineStatus = baselineStatus || null;
  out.allWeeks = allWeeks;
  out.latestWeek = latestWeek || null;
  out.previousWeek = previousWeek || null;

  const activeBaseline = baselineStatus?.activeBaseline || null;
  const baselineRows = Array.isArray(activeBaseline?.rows) ? activeBaseline.rows : [];
  const latestWeekRows = Array.isArray(latestWeek?.rows) ? latestWeek.rows : [];
  const previousWeekRows = Array.isArray(previousWeek?.rows) ? previousWeek.rows : [];

  out.baselineRows = baselineRows;
  out.latestWeekRows = latestWeekRows;
  out.previousWeekRows = previousWeekRows;

  if (!activeBaseline) {
    out.state = baselineStatus?.pendingBaseline ? "pending_baseline" : "missing_baseline";
    return out;
  }

  out.baselineMonthKpis = computeKpisFromRows(baselineRows);
  out.baselineWeeklyKpis = normalizeBaselineMonthToWeeklyAvg(out.baselineMonthKpis);

  if (!latestWeek) {
    out.ok = true;
    out.state = "baseline_only";
    return out;
  }

  out.latestWeekKpis = computeKpisFromRows(latestWeekRows);
  out.previousWeekKpis = previousWeek ? computeKpisFromRows(previousWeekRows) : null;
  out.ok = true;
  out.state = "live";

  return out;
}

/* =========================================================
   Shared rollup loader
========================================================= */

export async function loadCommercialRollupTruth() {
  const ctx = getCommercialSessionContext();
  const scope = inferScope(ctx);

  const result = {
    ok: false,
    orgId: ctx.orgId,
    role: ctx.role,
    scopeLevel: scope.level,
    scopeStoreId: scope.storeId || "",
    scopeDistrictId: scope.districtId || "",
    scopeRegionId: scope.regionId || "",
    storesInScope: [],
    childRows: [],
    baselineWeeklyKpis: null,
    latestWeekKpis: null,
    previousWeekKpis: null,
    latestWeekLabel: "",
    previousWeekLabel: "",
    counts: {
      totalStores: 0,
      storesWithBaseline: 0,
      storesLive: 0
    },
    state: "missing_context",
    message: "Missing org context."
  };

  if (!ctx.orgId) {
    return result;
  }

  const allStores = await listStores(ctx.orgId);
  const scopedStores = (allStores || [])
    .filter(store => store?.active !== false && store?.archived !== true)
    .filter(store => storeMatchesScope(store, scope));

  result.counts.totalStores = scopedStores.length;

  if (!scopedStores.length) {
    result.state = "no_stores";
    result.message = "No stores found for this scope.";
    return result;
  }

  const storeTruths = [];
  for (const store of scopedStores) {
    const truth = await loadStoreApprovedTruth(ctx.orgId, store);
    storeTruths.push({
      storeMeta: store,
      ...truth
    });
  }

  result.storesInScope = storeTruths;

  const baselineStores = storeTruths.filter(x => x.baselineWeeklyKpis);
  const liveStores = storeTruths.filter(x => x.state === "live" && x.latestWeekKpis);

  result.counts.storesWithBaseline = baselineStores.length;
  result.counts.storesLive = liveStores.length;

  if (!baselineStores.length) {
    result.state = "missing_baseline";
    result.message = "No approved baseline found in this scope.";
    return result;
  }

  result.baselineWeeklyKpis = aggregateKpis(
    baselineStores.map(x => x.baselineWeeklyKpis).filter(Boolean)
  );

  if (!liveStores.length) {
    result.ok = true;
    result.state = "baseline_only";
    result.message = "Approved baselines found, but no live weekly data in this scope.";
  } else {
    result.latestWeekKpis = aggregateKpis(
      liveStores.map(x => x.latestWeekKpis).filter(Boolean)
    );

    const previousComparableStores = liveStores.filter(x => x.previousWeekKpis);
    result.previousWeekKpis = previousComparableStores.length
      ? aggregateKpis(previousComparableStores.map(x => x.previousWeekKpis))
      : null;

    const latestLabels = liveStores.map(x => cleanString(x.latestWeek?.weekStart)).filter(Boolean);
    const previousLabels = liveStores.map(x => cleanString(x.previousWeek?.weekStart)).filter(Boolean);

    result.latestWeekLabel = latestLabels.length ? latestLabels.sort().slice(-1)[0] : "";
    result.previousWeekLabel = previousLabels.length ? previousLabels.sort().slice(-1)[0] : "";

    result.ok = true;
    result.state = "live";
    result.message = "Rollup baseline and weekly data loaded.";
  }

  /* ---------------------------------------------------------
     Child rows for drill-down tables
     DM => stores
     RM => districts
     VP => regions
  --------------------------------------------------------- */

  const childMap = new Map();

  for (const item of storeTruths) {
    const key = childKeyForLevel(scope.level, item.storeMeta);
    const label = childLabelForLevel(scope.level, item.storeMeta);

    if (!childMap.has(key)) {
      childMap.set(key, {
        key,
        label,
        level:
          scope.level === "district" ? "store" :
          scope.level === "region" ? "district" :
          scope.level === "org" ? "region" :
          "store",
        stores: [],
        baselineWeeklyKpis: null,
        latestWeekKpis: null,
        previousWeekKpis: null
      });
    }

    childMap.get(key).stores.push(item);
  }

  const childRows = [];
  for (const [, child] of childMap.entries()) {
    const childBaselineStores = child.stores.filter(x => x.baselineWeeklyKpis);
    const childLiveStores = child.stores.filter(x => x.latestWeekKpis);
    const childPrevStores = child.stores.filter(x => x.previousWeekKpis);

    child.baselineWeeklyKpis = childBaselineStores.length
      ? aggregateKpis(childBaselineStores.map(x => x.baselineWeeklyKpis))
      : null;

    child.latestWeekKpis = childLiveStores.length
      ? aggregateKpis(childLiveStores.map(x => x.latestWeekKpis))
      : null;

    child.previousWeekKpis = childPrevStores.length
      ? aggregateKpis(childPrevStores.map(x => x.previousWeekKpis))
      : null;

    child.counts = {
      stores: child.stores.length,
      baselineStores: childBaselineStores.length,
      liveStores: childLiveStores.length
    };

    childRows.push(child);
  }

  result.childRows = childRows.sort((a, b) =>
    String(a.label || "").localeCompare(String(b.label || ""))
  );

  return result;
}