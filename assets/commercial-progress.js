// /assets/commercial-progress.js (v5)
// Commercial Progress — unified KPI engine
// ✅ Uses shared KPI engine (FIXED)
// ✅ Baseline weekly vs all weeks
// ✅ WoW + trend + heat map
// 🚫 No KPI math changes

import { loadCommercialStoreTruth } from "./commercial-kpi-data.js";
import { computeKpisFromRows } from "./core-kpi-engine.js";

const ROOT_ID = "commercialProgressRoot";
const $ = (id) => document.getElementById(id);

const LS_COMM_ACTIVE_STORE = "FLQSR_COMM_ACTIVE_STORE_ID";

/* ---------------- helpers ---------------- */

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch {
    return null;
  }
}

function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return String(params.get(name) || "").trim();
}

function resolveSelectedStore() {
  const s = readSession() || {};

  return (
    getUrlParam("store") ||
    s.selectedStoreId ||
    s.activeStoreId ||
    s.storeId ||
    (Array.isArray(s.assigned_store_ids) ? s.assigned_store_ids[0] : "") ||
    ""
  ).trim();
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function prettyLabel(v) {
  return String(v || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, m => m.toUpperCase());
}

/* ---------------- styles ---------------- */

function injectStyles() {
  if (document.getElementById("commercialProgressStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialProgressStyles";
  style.textContent = `
    #${ROOT_ID} .progCard{
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
      border-radius:14px;
      padding:14px;
    }

    #${ROOT_ID} .progGrid3{
      display:grid;
      grid-template-columns:repeat(3, minmax(0,1fr));
      gap:12px;
      margin-top:14px;
    }

    #${ROOT_ID} .progMetricValue{
      font-size:24px;
      font-weight:900;
    }

    #${ROOT_ID} .progHeatCell{
      padding:6px 10px;
      border-radius:8px;
      font-weight:900;
    }

    .heat-good{ color:#22c55e; }
    .heat-bad{ color:#ef4444; }
    .heat-watch{ color:#f59e0b; }
  `;
  document.head.appendChild(style);
}

/* ---------------- format ---------------- */

function fmtMoney(x) {
  return Number(x || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
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

function heatClass(val) {
  if (val > 2) return "heat-good";
  if (val < -2) return "heat-bad";
  return "heat-watch";
}

/* ---------------- render ---------------- */

function renderLocked(msg) {
  setHtml(ROOT_ID, `<div class="card"><h2>${msg}</h2></div>`);
}

function renderProgress(truth) {
  const weeks = truth.allWeeks || [];
  const baseline = truth.baselineWeeklyKpis || {};

  if (!weeks.length) {
    renderLocked("No weekly data.");
    return;
  }

  const rows = weeks.map((w, i) => {
    const k = computeKpisFromRows(w.rows || []);
    const prev = weeks[i - 1]
      ? computeKpisFromRows(weeks[i - 1].rows || [])
      : null;

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
        labor: k.laborPct - Number(baseline.laborPct || 0)
      }
    };
  });

  const latest = rows[rows.length - 1];

  const table = rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td>${fmtMoney(r.k.sales)}</td>
      <td>${r.k.transactions}</td>
      <td>${fmtPct(r.k.laborPct)}</td>
      <td class="${heatClass(r.vsBase.sales)}">${r.vsBase.sales.toFixed(1)}%</td>
    </tr>
  `).join("");

  setHtml(ROOT_ID, `
    <div class="progCard">
      <h2>Progress — ${prettyLabel(truth.storeId)}</h2>

      <div class="progGrid3">
        <div>
          <div>Sales</div>
          <div class="progMetricValue">${fmtMoney(latest.k.sales)}</div>
          <div>${latest.vsBase.sales.toFixed(1)}% vs baseline</div>
        </div>

        <div>
          <div>Transactions</div>
          <div class="progMetricValue">${latest.k.transactions}</div>
          <div>${latest.vsBase.tx.toFixed(1)}% vs baseline</div>
        </div>

        <div>
          <div>Labor %</div>
          <div class="progMetricValue">${fmtPct(latest.k.laborPct)}</div>
          <div>${latest.vsBase.labor.toFixed(2)} vs baseline</div>
        </div>
      </div>
    </div>

    <div class="progCard" style="margin-top:14px;">
      <h3>Weekly Trend</h3>
      <table style="width:100%;margin-top:10px;">
        <thead>
          <tr>
            <th>Week</th>
            <th>Sales</th>
            <th>Tx</th>
            <th>Labor %</th>
            <th>vs Base</th>
          </tr>
        </thead>
        <tbody>${table}</tbody>
      </table>
    </div>
  `);
}

/* ---------------- init ---------------- */

async function load() {
  const store = resolveSelectedStore();

  try {
    const truth = await loadCommercialStoreTruth({ storeId: store });

    if (!truth || truth.state !== "live") {
      renderLocked("Waiting for baseline + weekly data.");
      return;
    }

    renderProgress(truth);
  } catch (e) {
    console.error(e);
    renderLocked("Error loading progress.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  injectStyles();
  load();
});