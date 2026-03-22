// /assets/commercial-progress.js (v8)
// Progress — shared premium commercial design
// ✅ Uses shared KPI engine
// ✅ WoW is primary signal
// ✅ Baseline comparison is neutral reference
// ✅ Uses shared styles.css card/panel system
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
  if (!isFinite(n) || n === 0) return "pending";
  if (favorableDirection === "down") {
    return n < 0 ? "good" : "bad";
  }
  return n > 0 ? "good" : "bad";
}

function baselineRefClass(deltaPct) {
  const n = Number(deltaPct);
  if (!isFinite(n)) return "pending";
  if (Math.abs(n) <= 2) return "pending";
  return n > 0 ? "good" : "bad";
}

/* ---------------- render helpers ---------------- */

function renderLocked(msg) {
  setHtml(ROOT_ID, `
    <section class="cprog-stack">
      <div class="card">
        <h2 class="section-title">${msg}</h2>
      </div>
    </section>
  `);
}

function summaryMetricCard(label, value, wowText, wowClass, baseText, baseClass) {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-delta ${wowClass}">${wowText}</div>
      <div class="cprog-ref ${baseClass}">${baseText}</div>
    </div>
  `;
}

function buildSummaryMetrics(latest) {
  const wowSales = latest.wow ? latest.wow.sales : null;
  const wowTx = latest.wow ? latest.wow.tx : null;
  const wowLabor = latest.wow ? latest.wow.labor : null;

  return `
    <div class="kpi-grid cprog-kpi-grid">
      ${summaryMetricCard(
        "Sales",
        fmtMoney(latest.k.sales),
        latest.wow ? `${fmtMoneySigned(wowSales)} vs last week` : "No prior week yet",
        latest.wow ? trendClass(wowSales, "up") : "pending",
        `Reference: ${latest.vsBase.sales.toFixed(1)}% vs baseline week`,
        baselineRefClass(latest.vsBase.sales)
      )}

      ${summaryMetricCard(
        "Transactions",
        fmtInt(latest.k.transactions),
        latest.wow ? `${fmtIntSigned(wowTx)} vs last week` : "No prior week yet",
        latest.wow ? trendClass(wowTx, "up") : "pending",
        `Reference: ${latest.vsBase.tx.toFixed(1)}% vs baseline week`,
        baselineRefClass(latest.vsBase.tx)
      )}

      ${summaryMetricCard(
        "Labor %",
        fmtPct(latest.k.laborPct),
        latest.wow ? `${fmtPtsSigned(wowLabor)} pts vs last week` : "No prior week yet",
        latest.wow ? trendClass(wowLabor, "down") : "pending",
        `Reference: ${fmtPtsSigned(latest.vsBase.labor)} pts vs baseline`,
        baselineRefClass(-latest.vsBase.labor)
      )}
    </div>
  `;
}

function renderProgress(truth) {
  const weeks = truth.allWeeks || [];
  const baseline = truth.baselineWeeklyKpis || {};
  const baselineLabel =
    truth.baselineStatus?.activeBaseline?.label ||
    truth.baselineStatus?.activeBaseline?.year ||
    "Approved baseline";

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
      <td class="${r.wow ? trendClass(r.wow.sales, "up") : "pending"}">
        ${r.wow ? fmtMoneySigned(r.wow.sales) : "—"}
      </td>
      <td class="${r.wow ? trendClass(r.wow.tx, "up") : "pending"}">
        ${r.wow ? fmtIntSigned(r.wow.tx) : "—"}
      </td>
      <td class="${r.wow ? trendClass(r.wow.labor, "down") : "pending"}">
        ${r.wow ? `${fmtPtsSigned(r.wow.labor)} pts` : "—"}
      </td>
      <td class="${baselineRefClass(r.vsBase.sales)}">
        ${r.vsBase.sales.toFixed(1)}%
        <div class="cprog-ref-text">vs baseline sales</div>
      </td>
    </tr>
  `).join("");

  setHtml(ROOT_ID, `
    <section class="cprog-stack">
      <div class="card">
        <h2 class="section-title">Progress — ${prettyLabel(truth.storeId)}</h2>
        <p class="section-sub">
          Trend view uses week-over-week movement as the primary signal. Baseline remains a reference point.
        </p>
        <p class="section-sub cprog-tight">
          Baseline Reference: <span class="cprog-text-strong">${baselineLabel}</span>
        </p>

        ${buildSummaryMetrics(latest)}
      </div>

      <div class="card">
        <h3 class="section-title cprog-subtitle">Weekly Trend</h3>
        <div class="cprog-table-wrap">
          <table class="cprog-table">
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
    </section>
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
  load();
});