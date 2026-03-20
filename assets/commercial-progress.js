// /assets/commercial-progress.js (v7)
// Progress — unified light-card commercial design
// ✅ Uses shared KPI engine
// ✅ WoW is primary signal
// ✅ Baseline comparison is neutral reference
// ✅ Matches commercial light-card system
// 🚫 No KPI math changes

import { loadCommercialStoreTruth } from "./commercial-kpi-data.js";
import { computeKpisFromRows } from "./core-kpi-engine.js";

const ROOT_ID = "commercialProgressRoot";
const $ = (id) => document.getElementById(id);

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
    #${ROOT_ID}{
      color:#0f172a;
    }

    #${ROOT_ID} .progCard{
      border:1px solid rgba(15,23,42,.08);
      background:#f8fafc;
      border-radius:16px;
      padding:16px;
      color:#0f172a;
      box-shadow:0 8px 24px rgba(15,23,42,.05);
    }

    #${ROOT_ID} .progCard + .progCard{
      margin-top:14px;
    }

    #${ROOT_ID} .progGrid3{
      display:grid;
      grid-template-columns:repeat(3, minmax(0,1fr));
      gap:12px;
      margin-top:14px;
    }

    #${ROOT_ID} .progMetric{
      border:1px solid rgba(15,23,42,.08);
      background:rgba(255,255,255,.88);
      border-radius:12px;
      padding:14px;
      color:#0f172a;
    }

    #${ROOT_ID} .progMetricLabel{
      font-size:12px;
      line-height:1.4;
      color:rgba(15,23,42,.68);
      font-weight:700;
      margin-bottom:6px;
    }

    #${ROOT_ID} .progMetricValue{
      font-size:24px;
      font-weight:900;
      line-height:1.1;
      margin-bottom:8px;
      color:#0f172a;
    }

    #${ROOT_ID} .progMetricTrend{
      font-size:13px;
      line-height:1.45;
      font-weight:800;
      margin-bottom:6px;
    }

    #${ROOT_ID} .progMetricBase{
      font-size:12px;
      line-height:1.45;
      color:rgba(15,23,42,.60);
    }

    #${ROOT_ID} .trend-good{
      color:#166534;
    }

    #${ROOT_ID} .trend-bad{
      color:#b91c1c;
    }

    #${ROOT_ID} .trend-neutral{
      color:#92400e;
    }

    #${ROOT_ID} .progTableWrap{
      overflow:auto;
      margin-top:12px;
      border:1px solid rgba(15,23,42,.08);
      border-radius:12px;
      background:#fff;
    }

    #${ROOT_ID} table{
      width:100%;
      min-width:760px;
      border-collapse:collapse;
      color:#0f172a;
    }

    #${ROOT_ID} th,
    #${ROOT_ID} td{
      padding:10px 12px;
      text-align:left;
      border-bottom:1px solid rgba(15,23,42,.06);
      font-size:13px;
      vertical-align:top;
      color:#0f172a;
    }

    #${ROOT_ID} th{
      font-weight:900;
      background:rgba(15,23,42,.04);
    }

    #${ROOT_ID} .refText{
      color:rgba(15,23,42,.60);
      font-size:12px;
      line-height:1.4;
    }

    @media (max-width: 900px){
      #${ROOT_ID} .progGrid3{
        grid-template-columns:1fr;
      }
    }
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

function fmtMoneySigned(x) {
  const n = Number(x || 0);
  const abs = Math.abs(n).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${abs.replace("-", "")}`;
}

function fmtInt(x) {
  return Number(x || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
}

function fmtIntSigned(x) {
  const n = Number(x || 0);
  const abs = Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${abs.replace("-", "")}`;
}

function fmtPct(x) {
  const n = Number(x);
  if (!isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtPtsSigned(x) {
  const n = Number(x);
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n).toFixed(2);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${abs}`;
}

function delta(a, b) {
  return Number(a || 0) - Number(b || 0);
}

function pctDelta(a, b) {
  if (!b) return 0;
  return ((a - b) / b) * 100;
}

function trendClass(deltaValue, favorableDirection = "up") {
  const n = Number(deltaValue);
  if (!isFinite(n) || n === 0) return "trend-neutral";
  if (favorableDirection === "down") {
    return n < 0 ? "trend-good" : "trend-bad";
  }
  return n > 0 ? "trend-good" : "trend-bad";
}

function baselineRefClass(deltaPct) {
  const n = Number(deltaPct);
  if (!isFinite(n)) return "trend-neutral";
  if (Math.abs(n) <= 2) return "trend-neutral";
  return n > 0 ? "trend-good" : "trend-bad";
}

/* ---------------- render ---------------- */

function renderLocked(msg) {
  setHtml(ROOT_ID, `<div class="card"><h2>${msg}</h2></div>`);
}

function buildSummaryMetrics(latest) {
  const wowSales = latest.wow ? latest.wow.sales : null;
  const wowTx = latest.wow ? latest.wow.tx : null;
  const wowLabor = latest.wow ? latest.wow.labor : null;

  return `
    <div class="progGrid3">
      <div class="progMetric">
        <div class="progMetricLabel">Sales</div>
        <div class="progMetricValue">${fmtMoney(latest.k.sales)}</div>
        <div class="progMetricTrend ${trendClass(wowSales, "up")}">
          ${latest.wow ? `${fmtMoneySigned(wowSales)} vs last week` : "No prior week yet"}
        </div>
        <div class="progMetricBase ${baselineRefClass(latest.vsBase.sales)}">
          Reference: ${latest.vsBase.sales.toFixed(1)}% vs baseline week
        </div>
      </div>

      <div class="progMetric">
        <div class="progMetricLabel">Transactions</div>
        <div class="progMetricValue">${fmtInt(latest.k.transactions)}</div>
        <div class="progMetricTrend ${trendClass(wowTx, "up")}">
          ${latest.wow ? `${fmtIntSigned(wowTx)} vs last week` : "No prior week yet"}
        </div>
        <div class="progMetricBase ${baselineRefClass(latest.vsBase.tx)}">
          Reference: ${latest.vsBase.tx.toFixed(1)}% vs baseline week
        </div>
      </div>

      <div class="progMetric">
        <div class="progMetricLabel">Labor %</div>
        <div class="progMetricValue">${fmtPct(latest.k.laborPct)}</div>
        <div class="progMetricTrend ${trendClass(wowLabor, "down")}">
          ${latest.wow ? `${fmtPtsSigned(wowLabor)} pts vs last week` : "No prior week yet"}
        </div>
        <div class="progMetricBase ${baselineRefClass(-latest.vsBase.labor)}">
          Reference: ${fmtPtsSigned(latest.vsBase.labor)} pts vs baseline
        </div>
      </div>
    </div>
  `;
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
      <td>${fmtInt(r.k.transactions)}</td>
      <td>${fmtPct(r.k.laborPct)}</td>
      <td class="${r.wow ? trendClass(r.wow.sales, "up") : "trend-neutral"}">
        ${r.wow ? fmtMoneySigned(r.wow.sales) : "—"}
      </td>
      <td class="${r.wow ? trendClass(r.wow.tx, "up") : "trend-neutral"}">
        ${r.wow ? fmtIntSigned(r.wow.tx) : "—"}
      </td>
      <td class="${r.wow ? trendClass(r.wow.labor, "down") : "trend-neutral"}">
        ${r.wow ? `${fmtPtsSigned(r.wow.labor)} pts` : "—"}
      </td>
      <td class="${baselineRefClass(r.vsBase.sales)}">
        ${r.vsBase.sales.toFixed(1)}%
        <div class="refText">vs baseline sales</div>
      </td>
    </tr>
  `).join("");

  setHtml(ROOT_ID, `
    <div class="progCard">
      <h2>Progress — ${prettyLabel(truth.storeId)}</h2>
      <div class="refText">Trend view uses week-over-week movement as the primary signal. Baseline remains a reference point.</div>
      ${buildSummaryMetrics(latest)}
    </div>

    <div class="progCard">
      <h3>Weekly Trend</h3>
      <div class="progTableWrap">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Sales</th>
              <th>Transactions</th>
              <th>Labor %</th>
              <th>WoW Sales</th>
              <th>WoW Tx</th>
              <th>WoW Labor</th>
              <th>Baseline Ref</th>
            </tr>
          </thead>
          <tbody>${table}</tbody>
        </table>
      </div>
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