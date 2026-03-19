// /assets/commercial-progress.js (v2)
// Commercial Progress — live weekly trend
// ✅ Uses commercial-kpi-data.js
// ✅ Baseline weekly equivalent vs all approved weeks
// ✅ Real WoW + trend visibility
// 🚫 No KPI math changes

import { loadCommercialStoreTruth } from "./commercial-kpi-data.js";

const ROOT_ID = "commercialProgressRoot";
const $ = (id) => document.getElementById(id);

/* ---------------- helpers ---------------- */

function prettyLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, m => m.toUpperCase());
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function fmtMoney(x) {
  return Number(x || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function fmtMoney2(x) {
  return Number(x || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });
}

function fmtPct(x) {
  return (Number(x || 0)).toFixed(2) + "%";
}

function delta(a, b) {
  return Number(a || 0) - Number(b || 0);
}

function pctDelta(a, b) {
  if (!b) return 0;
  return ((a - b) / b) * 100;
}

/* ---------------- KPI calc (same logic) ---------------- */

function computeKpis(rows) {
  let sales = 0, tx = 0, labor = 0;

  for (const r of rows || []) {
    sales += Number(r.Sales || 0);
    tx += Number(r.Transactions || 0);
    labor += Number(r.Labor || 0);
  }

  const laborPct = sales > 0 ? (labor / sales) * 100 : 0;
  const avgTicket = tx > 0 ? (sales / tx) : 0;

  return { sales, transactions: tx, laborPct, avgTicket };
}

/* ---------------- rendering ---------------- */

function renderLocked(msg) {
  setHtml(ROOT_ID, `
    <div class="card">
      <h2>${msg}</h2>
    </div>
  `);
}

function heatClass(val) {
  if (val > 2) return "heat-good";
  if (val < -2) return "heat-bad";
  return "heat-watch";
}

function renderProgress(truth) {

  const weeks = truth.allWeeks || [];
  const baseline = truth.baselineWeeklyKpis;

  if (!weeks.length) {
    renderLocked("No approved weekly data available.");
    return;
  }

  const rows = weeks.map((w, i) => {
    const k = computeKpis(w.rows);
    const prev = weeks[i - 1] ? computeKpis(weeks[i - 1].rows) : null;

    return {
      label: w.weekStart,
      k,
      wow: prev ? {
        sales: delta(k.sales, prev.sales),
        tx: delta(k.transactions, prev.transactions),
        labor: delta(k.laborPct, prev.laborPct)
      } : null,
      vsBase: {
        sales: pctDelta(k.sales, baseline.sales),
        tx: pctDelta(k.transactions, baseline.transactions),
        labor: k.laborPct - baseline.laborPct
      }
    };
  });

  const latest = rows[rows.length - 1];

  /* ---- heat map ---- */
  const heatRows = rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td><span class="progHeatCell ${heatClass(r.vsBase.sales)}">${r.vsBase.sales.toFixed(1)}%</span></td>
      <td><span class="progHeatCell ${heatClass(r.vsBase.tx)}">${r.vsBase.tx.toFixed(1)}%</span></td>
      <td><span class="progHeatCell ${heatClass(r.vsBase.labor)}">${r.vsBase.labor.toFixed(2)}</span></td>
    </tr>
  `).join("");

  /* ---- table ---- */
  const tableRows = rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td>${fmtMoney(r.k.sales)}</td>
      <td>${r.k.transactions.toLocaleString()}</td>
      <td>${fmtMoney2(r.k.avgTicket)}</td>
      <td>${fmtPct(r.k.laborPct)}</td>
      <td>${r.wow ? fmtMoney(r.wow.sales) : "—"}</td>
      <td>${r.wow ? r.wow.tx : "—"}</td>
      <td>${r.wow ? r.wow.labor.toFixed(2) : "—"}</td>
    </tr>
  `).join("");

  setHtml(ROOT_ID, `
    <div class="progCard">
      <h2>Weekly Outcome — ${prettyLabel(truth.storeId)}</h2>

      <div class="progGrid3" style="margin-top:14px;">
        <div class="progMetric">
          <div class="progMetricLabel">Sales</div>
          <div class="progMetricValue">${fmtMoney(latest.k.sales)}</div>
          <div class="progMetricSub">${latest.vsBase.sales.toFixed(1)}% vs baseline</div>
        </div>

        <div class="progMetric">
          <div class="progMetricLabel">Transactions</div>
          <div class="progMetricValue">${latest.k.transactions.toLocaleString()}</div>
          <div class="progMetricSub">${latest.vsBase.tx.toFixed(1)}% vs baseline</div>
        </div>

        <div class="progMetric">
          <div class="progMetricLabel">Labor %</div>
          <div class="progMetricValue">${fmtPct(latest.k.laborPct)}</div>
          <div class="progMetricSub">${latest.vsBase.labor.toFixed(2)} vs baseline</div>
        </div>
      </div>
    </div>

    <div class="progCard progSection">
      <h3>Trend Heat Map</h3>
      <table class="progHeatTable">
        <thead>
          <tr>
            <th>Week</th>
            <th>Sales</th>
            <th>Tx</th>
            <th>Labor</th>
          </tr>
        </thead>
        <tbody>${heatRows}</tbody>
      </table>
    </div>

    <div class="progCard progSection">
      <h3>Weekly Detail</h3>
      <table class="progHeatTable">
        <thead>
          <tr>
            <th>Week</th>
            <th>Sales</th>
            <th>Transactions</th>
            <th>Avg Ticket</th>
            <th>Labor %</th>
            <th>WoW Sales</th>
            <th>WoW Tx</th>
            <th>WoW Labor</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `);
}

/* ---------------- init ---------------- */

async function load() {
  try {
    const truth = await loadCommercialStoreTruth();

    if (truth.state !== "ready") {
      renderLocked("Waiting for approved baseline + weekly data.");
      return;
    }

    renderProgress(truth);

  } catch (e) {
    console.error(e);
    renderLocked("Failed to load progress.");
  }
}

window.addEventListener("DOMContentLoaded", load);