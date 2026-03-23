// /assets/commercial-rm.js (v9)
// Regional Manager page logic
// ✅ Uses commercial-rollup-data.js for approved rollup truth
// ✅ Uses commercial-db.js for district readiness summary
// ✅ Aggregates region totals from store-level approved truth
// ✅ Shows district drill-down table
// ✅ Adds Region Insight communication layer
// ✅ Adds Estimated Labor Impact
// ✅ Adds district readiness rollup
// ✅ Preserves scoped navigation
// 🚫 No KPI math changes

import { loadCommercialRollupTruth } from "./commercial-rollup-data.js";
import {
  listStores,
  getStoreWeekStatus
} from "./commercial-db.js";
import {
  fmtMoney,
  fmtMoney2,
  fmtNumber,
  fmtPct,
  deltaClass
} from "./core-kpi-engine.js";

const ROOT_ID = "commercialRmRoot";
const $ = (id) => document.getElementById(id);

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

function normalizeId(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    orgId: String(params.get("org") || "").trim(),
    regionId: normalizeId(params.get("region")),
    districtId: normalizeId(params.get("district")),
    storeId: normalizeId(params.get("store"))
  };
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

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function sign(v) {
  const n = Number(v);
  if (!isFinite(n) || n === 0) return "";
  return n > 0 ? "+" : "−";
}

function fmtDeltaMoney0(d) {
  const v = Number(d);
  if (!isFinite(v) || v === 0) return "0";
  const abs = Math.abs(v);
  const s = abs.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
  return `${sign(v)}${s.replace("-", "")}`;
}

function fmtDeltaMoney2(d) {
  const v = Number(d);
  if (!isFinite(v) || v === 0) return "0";
  const abs = Math.abs(v);
  const s = abs.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });
  return `${sign(v)}${s.replace("-", "")}`;
}

function fmtDeltaNumber0(d) {
  const v = Number(d);
  if (!isFinite(v) || v === 0) return "0";
  const abs = Math.abs(v);
  const s = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${sign(v)}${s}`;
}

function fmtDeltaPct(d) {
  const v = Number(d);
  if (!isFinite(v) || v === 0) return "0.00%";
  const abs = Math.abs(v);
  return `${sign(v)}${abs.toFixed(2)}%`;
}

function pctDelta(cur, base) {
  const c = Number(cur);
  const b = Number(base);
  if (!isFinite(c) || !isFinite(b) || b === 0) return NaN;
  return ((c - b) / b) * 100;
}

function metricCard(title, value, deltaText, deltaCls) {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${title}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-delta ${deltaCls || "pending"}">${deltaText || "—"}</div>
    </div>
  `;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function statusTone(status) {
  if (status === "APPROVED") return "good";
  if (status === "PENDING_APPROVAL") return "pending";
  return "bad";
}

function statusBadge(status) {
  return `<span class="status-pill ${statusTone(status)}">${String(status || "ACTION_NEEDED").replace(/_/g, " ")}</span>`;
}

/* =========================================================
   Header / nav
========================================================= */

function setRMHeaderContext() {
  const s = readSession() || {};
  const p = getParams();

  const role = String(s.role || "rm").toUpperCase();
  const orgId = p.orgId || s.orgId || "N/A";
  const selectedRegion = p.regionId;

  setText(
    "rmContext",
    `Org: ${orgId} | Role: ${role} | Region Scope: ${
      selectedRegion ? prettyLabel(selectedRegion) : "Assigned regional access"
    }`
  );

  setText(
    "activeRegion",
    selectedRegion
      ? `Selected Region: ${prettyLabel(selectedRegion)}`
      : "Selected Region: All assigned regions"
  );
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const p = getParams();
  selector.value = "rm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();
    const nextMap = {
      vp: "./commercial-vp.html",
      rm: "./commercial-rm.html",
      dm: "./commercial-dm.html",
      sm: "./commercial-portal.html"
    };

    const path = nextMap[view];
    if (!path) return;

    const next = new URL(path, window.location.href);
    if (p.orgId) next.searchParams.set("org", p.orgId);
    if (p.regionId) next.searchParams.set("region", p.regionId);
    if (p.districtId && view !== "vp") next.searchParams.set("district", p.districtId);
    if (p.storeId && view === "sm") next.searchParams.set("store", p.storeId);

    window.location.href = next.toString();
  });
}

/* =========================================================
   Region Insight
========================================================= */

function buildRegionInsight(truth) {
  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;
  const base = truth.baselineWeeklyKpis || {};
  const rows = Array.isArray(truth.childRows) ? truth.childRows : [];

  const salesVsBase = pctDelta(current.sales, base.sales);
  const txVsBase = pctDelta(current.transactions, base.transactions);
  const laborVsBase =
    isFinite(current.laborPct) && isFinite(base.laborPct)
      ? current.laborPct - base.laborPct
      : NaN;

  const salesWoW = prev ? safeNum(current.sales) - safeNum(prev.sales) : NaN;
  const txWoW = prev ? safeNum(current.transactions) - safeNum(prev.transactions) : NaN;
  const laborWoW =
    prev && isFinite(prev.laborPct) && isFinite(current.laborPct)
      ? current.laborPct - prev.laborPct
      : NaN;

  let direction = "Stable";
  if ((isFinite(salesWoW) && salesWoW > 0) || (isFinite(txWoW) && txWoW > 0)) {
    direction = "Improving";
  }
  if ((isFinite(salesWoW) && salesWoW < 0) || (isFinite(txWoW) && txWoW < 0)) {
    direction = "Under Pressure";
  }
  if (isFinite(laborWoW) && laborWoW > 0.35 && direction !== "Improving") {
    direction = "Guardrail Drift";
  }

  let estimatedLaborImpact = NaN;
  if (isFinite(laborVsBase) && isFinite(current.sales)) {
    estimatedLaborImpact = -(laborVsBase / 100) * current.sales;
  }

  const liveRows = rows.filter((row) => !!row.latestWeekKpis);
  const scoredRows = liveRows.map((row) => {
    const k = row.latestWeekKpis || {};
    const b = row.baselineWeeklyKpis || {};
    const p = row.previousWeekKpis || null;

    const wowSales = p ? safeNum(k.sales) - safeNum(p.sales) : 0;
    const wowTx = p ? safeNum(k.transactions) - safeNum(p.transactions) : 0;
    const wowLabor =
      p && isFinite(p.laborPct) && isFinite(k.laborPct)
        ? k.laborPct - p.laborPct
        : 0;

    const salesBasePct = pctDelta(k.sales, b.sales);
    const txBasePct = pctDelta(k.transactions, b.transactions);

    const pressureScore =
      (isFinite(salesBasePct) && salesBasePct < 0 ? Math.abs(salesBasePct) : 0) * 1.0 +
      (isFinite(txBasePct) && txBasePct < 0 ? Math.abs(txBasePct) : 0) * 0.9 +
      (wowSales < 0 ? Math.abs(wowSales) / 100 : 0) * 0.2 +
      (wowTx < 0 ? Math.abs(wowTx) : 0) * 0.02 +
      (wowLabor > 0 ? wowLabor : 0) * 4.0;

    return {
      label: row.label,
      key: row.key,
      pressureScore
    };
  });

  scoredRows.sort((a, b) => b.pressureScore - a.pressureScore);
  const topDistrict = scoredRows[0] || null;

  const priorityDistrict = topDistrict
    ? prettyLabel(topDistrict.label)
    : "No single district currently stands out";

  const driver = topDistrict
    ? `${prettyLabel(topDistrict.label)} is currently the main district to watch in the region.`
    : "Regional performance is staying relatively stable across active districts.";

  return {
    direction,
    salesVsBase,
    txVsBase,
    laborVsBase,
    estimatedLaborImpact,
    priorityDistrict,
    driver
  };
}

/* =========================================================
   Governance helpers
========================================================= */

async function loadRegionDistrictReadiness(orgId, regionId) {
  if (!orgId || !regionId) return {};

  const stores = await listStores(orgId);
  const activeStores = (stores || []).filter(
    (s) => s.active !== false && normalizeId(s.regionId) === normalizeId(regionId)
  );

  const districtMap = {};

  for (const store of activeStores) {
    const districtKey = normalizeId(store.districtId) || "unassigned";
    if (!districtMap[districtKey]) {
      districtMap[districtKey] = {
        districtId: districtKey,
        approved: 0,
        pending: 0,
        actionNeeded: 0
      };
    }

    const ws = await getStoreWeekStatus(orgId, store.id);

    if (ws?.pendingWeek) {
      districtMap[districtKey].pending += 1;
    } else if (ws?.latestApprovedWeek) {
      districtMap[districtKey].approved += 1;
    } else {
      districtMap[districtKey].actionNeeded += 1;
    }
  }

  return districtMap;
}

function summarizeRegionReadiness(districtReadinessMap) {
  const entries = Object.values(districtReadinessMap || {});
  return entries.reduce(
    (acc, x) => {
      acc.approved += Number(x.approved || 0);
      acc.pending += Number(x.pending || 0);
      acc.actionNeeded += Number(x.actionNeeded || 0);
      return acc;
    },
    { approved: 0, pending: 0, actionNeeded: 0 }
  );
}

function districtOverallStatus(readiness) {
  const pending = Number(readiness?.pending || 0);
  const actionNeeded = Number(readiness?.actionNeeded || 0);
  const approved = Number(readiness?.approved || 0);

  if (actionNeeded > 0) return "ACTION_NEEDED";
  if (pending > 0) return "PENDING_APPROVAL";
  if (approved > 0) return "APPROVED";
  return "ACTION_NEEDED";
}

/* =========================================================
   Rendering
========================================================= */

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <section class="crm-stack">
      <div class="card">
        <h2 class="section-title">${title}</h2>
        <p class="section-sub">${line1}</p>
        ${line2 ? `<p class="section-sub crm-tight">${line2}</p>` : ""}
      </div>
    </section>
  `);
}

function renderLiveRegion(truth, districtReadinessMap) {
  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;
  const base = truth.baselineWeeklyKpis || {};
  const insight = buildRegionInsight(truth);
  const readinessSummary = summarizeRegionReadiness(districtReadinessMap);

  const salesDelta = prev ? (current.sales - prev.sales) : NaN;
  const txDelta = prev ? (current.transactions - prev.transactions) : NaN;
  const laborPctDelta =
    prev && isFinite(prev.laborPct) && isFinite(current.laborPct)
      ? (current.laborPct - prev.laborPct)
      : NaN;
  const avgTicketDelta =
    prev && isFinite(prev.avgTicket) && isFinite(current.avgTicket)
      ? (current.avgTicket - prev.avgTicket)
      : NaN;

  const salesCls = deltaClass(salesDelta, "up");
  const txCls = deltaClass(txDelta, "up");
  const laborCls = deltaClass(laborPctDelta, "down");
  const avgTicketCls = deltaClass(avgTicketDelta, "up");

  const latestWeekLabel = truth.latestWeekLabel || "Latest approved week";

  const rowsHtml = (truth.childRows || []).map((row) => {
    const k = row.latestWeekKpis || null;
    const b = row.baselineWeeklyKpis || {};
    const p = row.previousWeekKpis || null;
    const readiness = districtReadinessMap?.[normalizeId(row.key)] || districtReadinessMap?.[normalizeId(row.label)] || {
      approved: 0,
      pending: 0,
      actionNeeded: 0
    };

    const wowSales = p && k ? (k.sales - p.sales) : NaN;
    const wowTx = p && k ? (k.transactions - p.transactions) : NaN;
    const wowLabor =
      p && k && isFinite(p.laborPct) && isFinite(k.laborPct)
        ? (k.laborPct - p.laborPct)
        : NaN;

    const salesVsBase = k ? pctDelta(k.sales, b.sales) : NaN;
    const txVsBase = k ? pctDelta(k.transactions, b.transactions) : NaN;
    const hasLive = !!k;
    const overallStatus = districtOverallStatus(readiness);

    return `
      <tr>
        <td><span class="crm-text-strong">${prettyLabel(row.label)}</span></td>
        <td>${statusBadge(overallStatus)}</td>
        <td>${fmtNumber(row.counts?.stores || 0)}</td>
        <td>${fmtNumber(readiness.approved || 0)}</td>
        <td>${fmtNumber(readiness.pending || 0)}</td>
        <td>${fmtNumber(readiness.actionNeeded || 0)}</td>
        <td>${hasLive ? fmtMoney(k.sales) : "—"}</td>
        <td>${hasLive ? fmtNumber(k.transactions) : "—"}</td>
        <td>${hasLive ? fmtPct(k.laborPct) : "—"}</td>
        <td>${hasLive ? fmtMoney2(k.avgTicket) : "—"}</td>
        <td class="${hasLive && p ? deltaClass(wowSales, "up") : "pending"}">${hasLive && p ? fmtDeltaMoney0(wowSales) : "—"}</td>
        <td class="${hasLive && p ? deltaClass(wowTx, "up") : "pending"}">${hasLive && p ? fmtDeltaNumber0(wowTx) : "—"}</td>
        <td class="${hasLive && p ? deltaClass(wowLabor, "down") : "pending"}">${hasLive && p ? fmtDeltaPct(wowLabor) : "—"}</td>
        <td class="${isFinite(salesVsBase) ? (salesVsBase >= 0 ? "good" : "bad") : "pending"}">
          ${isFinite(salesVsBase) ? salesVsBase.toFixed(1) + "%" : "—"}
        </td>
        <td class="${isFinite(txVsBase) ? (txVsBase >= 0 ? "good" : "bad") : "pending"}">
          ${isFinite(txVsBase) ? txVsBase.toFixed(1) + "%" : "—"}
        </td>
        <td>
          <button class="btn crm-drill-btn" type="button" data-district-id="${row.key}">Open District</button>
        </td>
      </tr>
    `;
  }).join("");

  setHtml(ROOT_ID, `
    <section class="crm-stack">
      <div class="card">
        <h2 class="section-title">Region Rollup — ${prettyLabel(truth.scopeRegionId || "Selected Region")}</h2>
        <p class="section-sub">
          Latest approved regional performance is aggregated from all active stores in scope.
        </p>
        <p class="section-sub crm-tight">
          Live Stores: <span class="crm-text-strong">${fmtNumber(truth.counts?.storesLive || 0)}</span> |
          Baseline Stores: <span class="crm-text-strong">${fmtNumber(truth.counts?.storesWithBaseline || 0)}</span> |
          Latest Week: <span class="crm-text-strong">${latestWeekLabel}</span>
        </p>
      </div>

      <div class="kpi-grid crm-kpi-grid">
        ${metricCard(
          "Region Sales",
          fmtMoney(current.sales),
          prev ? `${fmtDeltaMoney0(salesDelta)} vs previous week` : "No previous-week comparison yet",
          salesCls
        )}
        ${metricCard(
          "Region Transactions",
          fmtNumber(current.transactions),
          prev ? `${fmtDeltaNumber0(txDelta)} vs previous week` : "No previous-week comparison yet",
          txCls
        )}
        ${metricCard(
          "Region Labor %",
          fmtPct(current.laborPct),
          prev ? `${fmtDeltaPct(laborPctDelta)} vs previous week` : "No previous-week comparison yet",
          laborCls
        )}
        ${metricCard(
          "Region Avg Ticket",
          fmtMoney2(current.avgTicket),
          prev ? `${fmtDeltaMoney2(avgTicketDelta)} vs previous week` : "No previous-week comparison yet",
          avgTicketCls
        )}
      </div>

      <div class="card">
        <h3 class="section-title crm-subtitle">Region Insight</h3>
        <div class="status-wrap crm-status-wrap">
          <span class="status-pill">${insight.direction}</span>
        </div>

        <div class="meta-grid crm-meta-grid">
          <div class="info-box">
            <h3>Regional Trend</h3>
            <p>
              Sales vs baseline: ${isFinite(insight.salesVsBase) ? `${insight.salesVsBase.toFixed(1)}%` : "—"} |
              Transactions vs baseline: ${isFinite(insight.txVsBase) ? `${insight.txVsBase.toFixed(1)}%` : "—"} |
              Labor vs baseline: ${isFinite(insight.laborVsBase) ? `${insight.laborVsBase >= 0 ? "+" : ""}${insight.laborVsBase.toFixed(2)} pts` : "—"}
            </p>
          </div>
          <div class="info-box">
            <h3>Priority District</h3>
            <p>${insight.priorityDistrict}</p>
          </div>
        </div>

        <hr class="hr" />

        <h3 class="section-title crm-subtitle">Financial Impact</h3>
        <p class="section-sub">${insight.driver}</p>
        <p class="section-sub crm-tight">
          Estimated Labor Impact:
          <span class="${insight.estimatedLaborImpact > 0 ? "good" : insight.estimatedLaborImpact < 0 ? "bad" : "pending"} crm-text-strong">
            ${isFinite(insight.estimatedLaborImpact) ? fmtMoney(insight.estimatedLaborImpact) : "—"}
          </span>
        </p>
      </div>

      <div class="card">
        <h3 class="section-title crm-subtitle">Regional Readiness</h3>
        <div class="meta-grid crm-meta-grid">
          <div class="info-box">
            <h3>Approved</h3>
            <p>${fmtNumber(readinessSummary.approved)} stores</p>
          </div>
          <div class="info-box">
            <h3>Pending Approval</h3>
            <p>${fmtNumber(readinessSummary.pending)} stores</p>
          </div>
        </div>
        <div class="info-box" style="margin-top:12px;">
          <h3>Action Needed</h3>
          <p>${fmtNumber(readinessSummary.actionNeeded)} stores</p>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title crm-subtitle">Regional Baseline Reference</h3>
        <div class="crm-bullet-stack">
          <div>• Baseline Weekly Sales: ${fmtMoney(base.sales)}</div>
          <div>• Baseline Weekly Transactions: ${fmtNumber(base.transactions)}</div>
          <div>• Baseline Labor %: ${fmtPct(base.laborPct)}</div>
          <div>• Baseline Avg Ticket: ${fmtMoney2(base.avgTicket)}</div>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title crm-subtitle">District Breakdown</h3>
        <p class="section-sub">
          Click a district below to drill into the district manager view.
        </p>

        <div class="table-wrap crm-table-wrap">
          <table class="table crm-table" data-rm-district-table>
            <thead>
              <tr>
                <th>District</th>
                <th>Status</th>
                <th>Stores</th>
                <th>Approved</th>
                <th>Pending</th>
                <th>Action Needed</th>
                <th>Sales</th>
                <th>Transactions</th>
                <th>Labor %</th>
                <th>Avg Ticket</th>
                <th>WoW Sales</th>
                <th>WoW Tx</th>
                <th>WoW Labor</th>
                <th>Sales vs Base</th>
                <th>Tx vs Base</th>
                <th>Drill</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || `<tr><td colspan="16">No district rows found.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>
  `);
}

async function loadRegionRollup() {
  try {
    const truth = await loadCommercialRollupTruth();
    const p = getParams();
    const districtReadinessMap = await loadRegionDistrictReadiness(
      p.orgId || truth.orgId || "",
      p.regionId || truth.scopeRegionId || ""
    );

    if (truth.state === "missing_context") {
      renderLocked("Region Rollup", "Missing org context.");
      return;
    }

    if (truth.state === "no_stores") {
      renderLocked(
        "Region Rollup",
        truth.message || "No stores found in this region scope."
      );
      return;
    }

    if (truth.state === "missing_baseline") {
      renderLocked(
        `Region Rollup — ${prettyLabel(truth.scopeRegionId || "Selected Region")}`,
        "No approved baseline found in this region scope."
      );
      return;
    }

    if (truth.state === "baseline_only") {
      renderLocked(
        `Region Rollup — ${prettyLabel(truth.scopeRegionId || "Selected Region")}`,
        "Approved baselines found, but no approved weekly uploads exist yet in this region scope."
      );
      return;
    }

    renderLiveRegion(truth, districtReadinessMap);
    setupRMDistrictActions();
  } catch (e) {
    console.error("[commercial-rm] load failed:", e);
    renderLocked("Region Rollup", "Unable to load region rollup right now.");
  }
}

/* =========================================================
   Drill-down table actions
========================================================= */

function setupRMDistrictActions() {
  const table = document.querySelector("[data-rm-district-table]");
  if (!table) return;

  const p = getParams();

  table.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-district-id]");
    if (!trigger) return;

    const districtId = String(trigger.getAttribute("data-district-id") || "").trim();
    if (!districtId) return;

    const next = new URL("./commercial-dm.html", window.location.href);
    if (p.orgId) next.searchParams.set("org", p.orgId);
    if (p.regionId) next.searchParams.set("region", p.regionId);
    next.searchParams.set("district", districtId);

    window.location.href = next.toString();
  });
}

/* =========================================================
   Init
========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  setRMHeaderContext();
  setupViewSelector();
  await loadRegionRollup();
});