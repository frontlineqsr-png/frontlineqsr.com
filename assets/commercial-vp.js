// /assets/commercial-vp.js (v7)
// VP / Owner page logic
// ✅ Uses commercial-rollup-data.js
// ✅ Aggregates org totals from store-level approved truth
// ✅ Shows region drill-down table
// ✅ Adds Company Execution Insight
// ✅ Adds Estimated Labor Impact
// ✅ Preserves scoped navigation
// ✅ Normalizes region / district / store ids from URL
// 🚫 No KPI math changes

import { loadCommercialRollupTruth } from "./commercial-rollup-data.js";
import {
  fmtMoney,
  fmtMoney2,
  fmtNumber,
  fmtPct,
  deltaClass
} from "./core-kpi-engine.js";

const ROOT_ID = "commercialVpRoot";
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

/* =========================================================
   Header / nav
========================================================= */

function setVPHeaderContext() {
  const s = readSession() || {};
  const p = getParams();

  const role = String(s.role || "vp").toUpperCase();
  const orgId = p.orgId || s.orgId || "N/A";
  const regions = Array.isArray(s.assigned_region_ids) ? s.assigned_region_ids : [];

  setText(
    "vpContext",
    `Org: ${orgId} | Role: ${role} | Executive Scope: ${
      regions.length ? regions.map(prettyLabel).join(", ") : "Enterprise visibility"
    }`
  );
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const p = getParams();
  selector.value = "vp";

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
    if (p.regionId && (view === "rm" || view === "dm" || view === "sm")) {
      next.searchParams.set("region", p.regionId);
    }
    if (p.districtId && (view === "dm" || view === "sm")) {
      next.searchParams.set("district", p.districtId);
    }
    if (p.storeId && view === "sm") {
      next.searchParams.set("store", p.storeId);
    }

    window.location.href = next.toString();
  });
}

/* =========================================================
   Company Execution Insight
========================================================= */

function buildCompanyInsight(truth) {
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
    direction = "Margin Pressure";
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
      pressureScore,
      wowSales,
      wowTx,
      wowLabor,
      salesBasePct,
      txBasePct
    };
  });

  scoredRows.sort((a, b) => b.pressureScore - a.pressureScore);

  const topRegion = scoredRows[0] || null;

  let driver = "Company performance is staying relatively stable across active regions.";
  if (topRegion) {
    const parts = [];
    if (isFinite(topRegion.salesBasePct) && topRegion.salesBasePct < -1) {
      parts.push(`sales ${topRegion.salesBasePct.toFixed(1)}% below baseline`);
    }
    if (isFinite(topRegion.txBasePct) && topRegion.txBasePct < -1) {
      parts.push(`transactions ${topRegion.txBasePct.toFixed(1)}% below baseline`);
    }
    if (isFinite(topRegion.wowLabor) && topRegion.wowLabor > 0.25) {
      parts.push(`labor up ${topRegion.wowLabor.toFixed(2)} pts week-over-week`);
    }

    if (parts.length) {
      driver = `${prettyLabel(topRegion.label)} is creating the most enterprise pressure, with ${parts.join(" • ")}.`;
    } else {
      driver = `${prettyLabel(topRegion.label)} is currently the main region to watch at the company level.`;
    }
  }

  let focus = "Executive attention should stay targeted to the regions showing the most volatility before broad enterprise changes are made.";
  if (topRegion) {
    focus = `Executive attention should begin with ${prettyLabel(topRegion.label)} before making broad company-wide adjustments.`;
  }

  return {
    direction,
    salesVsBase,
    txVsBase,
    laborVsBase,
    estimatedLaborImpact,
    driver,
    focus
  };
}

/* =========================================================
   Rendering
========================================================= */

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <section class="cvp-stack">
      <div class="card">
        <h2 class="section-title">${title}</h2>
        <p class="section-sub">${line1}</p>
        ${line2 ? `<p class="section-sub cvp-tight">${line2}</p>` : ""}
      </div>
    </section>
  `);
}

function renderLiveOrg(truth) {
  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;
  const base = truth.baselineWeeklyKpis || {};
  const insight = buildCompanyInsight(truth);

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

    const wowSales = p && k ? (k.sales - p.sales) : NaN;
    const wowTx = p && k ? (k.transactions - p.transactions) : NaN;
    const wowLabor =
      p && k && isFinite(p.laborPct) && isFinite(k.laborPct)
        ? (k.laborPct - p.laborPct)
        : NaN;

    const salesVsBase = k ? pctDelta(k.sales, b.sales) : NaN;
    const txVsBase = k ? pctDelta(k.transactions, b.transactions) : NaN;

    const hasLive = !!k;

    return `
      <tr>
        <td><span class="cvp-text-strong">${prettyLabel(row.label)}</span></td>
        <td>${fmtNumber(row.counts?.stores || 0)}</td>
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
          <button class="btn cvp-drill-btn" type="button" data-region-id="${row.key}">Open Region</button>
        </td>
      </tr>
    `;
  }).join("");

  setHtml(ROOT_ID, `
    <section class="cvp-stack">
      <div class="card">
        <h2 class="section-title">Executive Rollup — Organization View</h2>
        <p class="section-sub">
          Latest approved organizational performance is aggregated from all active stores in scope.
        </p>
        <p class="section-sub cvp-tight">
          Live Stores: <span class="cvp-text-strong">${fmtNumber(truth.counts?.storesLive || 0)}</span> |
          Baseline Stores: <span class="cvp-text-strong">${fmtNumber(truth.counts?.storesWithBaseline || 0)}</span> |
          Latest Week: <span class="cvp-text-strong">${latestWeekLabel}</span>
        </p>
      </div>

      <div class="kpi-grid cvp-kpi-grid">
        ${metricCard(
          "Org Sales",
          fmtMoney(current.sales),
          prev ? `${fmtDeltaMoney0(salesDelta)} vs previous week` : "No previous-week comparison yet",
          salesCls
        )}
        ${metricCard(
          "Org Transactions",
          fmtNumber(current.transactions),
          prev ? `${fmtDeltaNumber0(txDelta)} vs previous week` : "No previous-week comparison yet",
          txCls
        )}
        ${metricCard(
          "Org Labor %",
          fmtPct(current.laborPct),
          prev ? `${fmtDeltaPct(laborPctDelta)} vs previous week` : "No previous-week comparison yet",
          laborCls
        )}
        ${metricCard(
          "Org Avg Ticket",
          fmtMoney2(current.avgTicket),
          prev ? `${fmtDeltaMoney2(avgTicketDelta)} vs previous week` : "No previous-week comparison yet",
          avgTicketCls
        )}
      </div>

      <div class="card">
        <h3 class="section-title cvp-subtitle">Company Execution Insight</h3>
        <div class="status-wrap cvp-status-wrap">
          <span class="status-pill">${insight.direction}</span>
        </div>

        <div class="meta-grid cvp-meta-grid">
          <div class="info-box">
            <h3>Company Direction</h3>
            <p>
              Sales vs baseline: ${isFinite(insight.salesVsBase) ? `${insight.salesVsBase.toFixed(1)}%` : "—"} |
              Transactions vs baseline: ${isFinite(insight.txVsBase) ? `${insight.txVsBase.toFixed(1)}%` : "—"} |
              Labor vs baseline: ${isFinite(insight.laborVsBase) ? `${insight.laborVsBase >= 0 ? "+" : ""}${insight.laborVsBase.toFixed(2)} pts` : "—"}
            </p>
          </div>
          <div class="info-box">
            <h3>Executive Focus</h3>
            <p>${insight.focus}</p>
          </div>
        </div>

        <hr class="hr" />

        <h3 class="section-title cvp-subtitle">What is driving company outcomes</h3>
        <p class="section-sub">${insight.driver}</p>
        <p class="section-sub cvp-tight">
          Estimated Labor Impact:
          <span class="${insight.estimatedLaborImpact > 0 ? "good" : insight.estimatedLaborImpact < 0 ? "bad" : "pending"} cvp-text-strong">
            ${isFinite(insight.estimatedLaborImpact) ? fmtMoney(insight.estimatedLaborImpact) : "—"}
          </span>
        </p>
      </div>

      <div class="card">
        <h3 class="section-title cvp-subtitle">Company Baseline Reference</h3>
        <div class="cvp-bullet-stack">
          <div>• Baseline Weekly Sales: ${fmtMoney(base.sales)}</div>
          <div>• Baseline Weekly Transactions: ${fmtNumber(base.transactions)}</div>
          <div>• Baseline Labor %: ${fmtPct(base.laborPct)}</div>
          <div>• Baseline Avg Ticket: ${fmtMoney2(base.avgTicket)}</div>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title cvp-subtitle">Region Breakdown</h3>
        <p class="section-sub">
          Click a region below to drill into the regional manager view.
        </p>

        <div class="table-wrap cvp-table-wrap">
          <table class="table cvp-table" data-vp-region-table>
            <thead>
              <tr>
                <th>Region</th>
                <th>Stores</th>
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
            <tbody>${rowsHtml || `<tr><td colspan="12">No region rows found.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>
  `);
}

async function loadExecutiveRollup() {
  try {
    const truth = await loadCommercialRollupTruth();

    if (truth.state === "missing_context") {
      renderLocked("Executive Rollup", "Missing org context.");
      return;
    }

    if (truth.state === "no_stores") {
      renderLocked("Executive Rollup", "No stores found in this org scope.");
      return;
    }

    if (truth.state === "missing_baseline") {
      renderLocked(
        "Executive Rollup — Organization View",
        "No approved baseline found in this org scope."
      );
      return;
    }

    if (truth.state === "baseline_only") {
      renderLocked(
        "Executive Rollup — Organization View",
        "Approved baselines found, but no approved weekly uploads exist yet in this org scope."
      );
      return;
    }

    renderLiveOrg(truth);
    setupVPRegionActions();
  } catch (e) {
    console.error("[commercial-vp] load failed:", e);
    renderLocked("Executive Rollup", "Unable to load executive rollup right now.");
  }
}

/* =========================================================
   Drill-down table actions
========================================================= */

function setupVPRegionActions() {
  const table = document.querySelector("[data-vp-region-table]");
  if (!table) return;

  const p = getParams();

  table.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-region-id]");
    if (!trigger) return;

    const regionId = String(trigger.getAttribute("data-region-id") || "").trim();
    if (!regionId) return;

    const next = new URL("./commercial-rm.html", window.location.href);
    if (p.orgId) next.searchParams.set("org", p.orgId);
    next.searchParams.set("region", regionId);

    window.location.href = next.toString();
  });
}

/* =========================================================
   Init
========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  setVPHeaderContext();
  setupViewSelector();
  await loadExecutiveRollup();
});