// /assets/commercial-dm.js (v9)
// District Manager page logic
// ✅ District totals
// ✅ District insight
// ✅ Estimated labor impact
// ✅ Store breakdown
// 🚫 No KPI math changes

import { loadCommercialRollupTruth } from "./commercial-rollup-data.js";
import {
  fmtMoney,
  fmtMoney2,
  fmtNumber,
  fmtPct,
  deltaClass
} from "./core-kpi-engine.js";

const ROOT_ID = "commercialDmRoot";
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
    districtId: normalizeId(params.get("district")),
    regionId: normalizeId(params.get("region")),
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

/* =========================================================
District Insight Builder
========================================================= */

function buildDistrictInsight(truth) {
  const current = truth.latestWeekKpis || {};
  const base = truth.baselineWeeklyKpis || {};
  const prev = truth.previousWeekKpis || null;

  const salesVsBase = pctDelta(current.sales, base.sales);
  const txVsBase = pctDelta(current.transactions, base.transactions);

  const laborVsBase =
    isFinite(current.laborPct) && isFinite(base.laborPct)
      ? current.laborPct - base.laborPct
      : NaN;

  /* ===========================
     Estimated Labor Impact
     =========================== */

  let laborImpact = NaN;

  if (isFinite(laborVsBase) && isFinite(current.sales)) {
    // invert sign so higher labor = negative impact
    laborImpact = -(laborVsBase / 100) * current.sales;
  }

  return {
    salesVsBase,
    txVsBase,
    laborVsBase,
    laborImpact
  };
}

/* =========================================================
Render
========================================================= */

function renderLiveDistrict(truth) {
  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;
  const base = truth.baselineWeeklyKpis || {};

  const insight = buildDistrictInsight(truth);

  const salesDelta = prev ? current.sales - prev.sales : NaN;
  const txDelta = prev ? current.transactions - prev.transactions : NaN;
  const laborPctDelta =
    prev && isFinite(prev.laborPct) && isFinite(current.laborPct)
      ? current.laborPct - prev.laborPct
      : NaN;
  const avgTicketDelta =
    prev && isFinite(prev.avgTicket) && isFinite(current.avgTicket)
      ? current.avgTicket - prev.avgTicket
      : NaN;

  const salesCls = deltaClass(salesDelta, "up");
  const txCls = deltaClass(txDelta, "up");
  const laborCls = deltaClass(laborPctDelta, "down");
  const avgTicketCls = deltaClass(avgTicketDelta, "up");

  const rowsHtml = (truth.childRows || []).map((row) => {
    const k = row.latestWeekKpis || {};
    return `
      <tr>
        <td>${prettyLabel(row.label)}</td>
        <td>${k ? fmtMoney(k.sales) : "—"}</td>
        <td>${k ? fmtNumber(k.transactions) : "—"}</td>
        <td>${k ? fmtPct(k.laborPct) : "—"}</td>
        <td>${k ? fmtMoney2(k.avgTicket) : "—"}</td>
      </tr>
    `;
  }).join("");

  setHtml(
    ROOT_ID,
    `
<div class="cdm-stack">

<div class="card">
<h2>District Rollup — ${prettyLabel(truth.scopeDistrictId)}</h2>
<div class="meta">
District performance aggregated across active stores.
</div>
</div>

<div class="kpi-grid cdm-kpi-grid">
${metricCard(
  "District Sales",
  fmtMoney(current.sales),
  prev ? fmtDeltaMoney0(salesDelta) + " vs last week" : "—",
  salesCls
)}
${metricCard(
  "District Transactions",
  fmtNumber(current.transactions),
  prev ? fmtDeltaNumber0(txDelta) + " vs last week" : "—",
  txCls
)}
${metricCard(
  "District Labor %",
  fmtPct(current.laborPct),
  prev ? fmtDeltaPct(laborPctDelta) + " vs last week" : "—",
  laborCls
)}
${metricCard(
  "District Avg Ticket",
  fmtMoney2(current.avgTicket),
  prev ? fmtDeltaMoney0(avgTicketDelta) + " vs last week" : "—",
  avgTicketCls
)}
</div>

<div class="card">
<h3 class="cdm-subtitle">District Insight</h3>

<div class="cdm-bullet-stack">

<div>
Sales vs baseline:
<strong>${isFinite(insight.salesVsBase) ? insight.salesVsBase.toFixed(1) + "%" : "—"}</strong>
</div>

<div>
Transactions vs baseline:
<strong>${isFinite(insight.txVsBase) ? insight.txVsBase.toFixed(1) + "%" : "—"}</strong>
</div>

<div>
Labor vs baseline:
<strong>${
  isFinite(insight.laborVsBase)
    ? (insight.laborVsBase >= 0 ? "+" : "") +
      insight.laborVsBase.toFixed(2) +
      " pts"
    : "—"
}</strong>
</div>

<div>
Estimated Labor Impact:
<strong class="${
  insight.laborImpact > 0 ? "good" : insight.laborImpact < 0 ? "bad" : ""
}">
${
  isFinite(insight.laborImpact)
    ? fmtMoney(insight.laborImpact)
    : "—"
}
</strong>
</div>

</div>

</div>

<div class="card">
<h3>Store Breakdown</h3>

<div class="table-wrap">
<table class="table">
<thead>
<tr>
<th>Store</th>
<th>Sales</th>
<th>Transactions</th>
<th>Labor %</th>
<th>Avg Ticket</th>
</tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>
</div>

</div>

</div>
`
  );
}

async function loadDistrictRollup() {
  const truth = await loadCommercialRollupTruth();
  renderLiveDistrict(truth);
}

window.addEventListener("DOMContentLoaded", loadDistrictRollup);