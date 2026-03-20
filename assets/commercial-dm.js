// /assets/commercial-dm.js (v5)
// District Manager page logic
// ✅ Uses commercial-rollup-data.js
// ✅ Aggregates district totals from store-level approved truth
// ✅ Shows store drill-down table
// ✅ Preserves scoped navigation
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

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    orgId: String(params.get("org") || "").trim(),
    districtId: String(params.get("district") || "").trim(),
    regionId: String(params.get("region") || "").trim(),
    storeId: String(params.get("store") || "").trim()
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
    <div class="card">
      <div class="small">${title}</div>
      <div class="cdm-value">${value}</div>
      <div class="cdm-delta ${deltaCls || ""}">${deltaText || "—"}</div>
    </div>
  `;
}

/* =========================================================
   Styles
========================================================= */

function injectStyles() {
  if (document.getElementById("commercialDmStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialDmStyles";
  style.textContent = `
    #${ROOT_ID}{
      color:#0f172a;
    }

    #${ROOT_ID} .cdm-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:14px;
      margin-bottom:18px;
    }

    #${ROOT_ID} .cdm-value{
      font-size:28px;
      font-weight:900;
      margin-top:8px;
      color:#0f172a;
      line-height:1.05;
    }

    #${ROOT_ID} .cdm-delta{
      margin-top:8px;
      font-size:13px;
      line-height:1.45;
    }

    #${ROOT_ID} .small{
      font-size:12px;
      color:rgba(15,23,42,.70);
      font-weight:700;
      margin-bottom:6px;
    }

    #${ROOT_ID} .meta{
      color:rgba(15,23,42,.72);
      font-size:14px;
      line-height:1.5;
    }

    #${ROOT_ID} .cdm-table-wrap{
      overflow:auto;
      margin-top:12px;
      border:1px solid rgba(15,23,42,.08);
      border-radius:12px;
      background:#fff;
    }

    #${ROOT_ID} table{
      width:100%;
      min-width:820px;
      border-collapse:collapse;
    }

    #${ROOT_ID} th,
    #${ROOT_ID} td{
      padding:12px;
      text-align:left;
      border-bottom:1px solid rgba(15,23,42,.06);
      font-size:13px;
      vertical-align:top;
      color:#0f172a;
    }

    #${ROOT_ID} th{
      background:rgba(15,23,42,.04);
      font-weight:900;
    }

    #${ROOT_ID} .drill-btn{
      border:1px solid rgba(15,23,42,.12);
      background:#111827;
      color:#fff;
      border-radius:10px;
      padding:8px 10px;
      font:inherit;
      font-size:12px;
      font-weight:800;
      cursor:pointer;
    }

    #${ROOT_ID} .good{
      color:#166534;
    }

    #${ROOT_ID} .bad{
      color:#b91c1c;
    }

    #${ROOT_ID} .pending{
      color:#92400e;
    }
  `;
  document.head.appendChild(style);
}

/* =========================================================
   Header / nav
========================================================= */

function setDMHeaderContext() {
  const s = readSession() || {};
  const p = getParams();

  const role = String(s.role || "dm").toUpperCase();
  const orgId = p.orgId || s.orgId || "N/A";
  const selectedDistrict = p.districtId;
  const selectedRegion = p.regionId;

  setText(
    "dmContext",
    `Org: ${orgId} | Role: ${role} | District Scope: ${
      selectedDistrict ? prettyLabel(selectedDistrict) : "Assigned district access"
    }`
  );

  setText(
    "activeDistrict",
    selectedDistrict
      ? `Selected District: ${prettyLabel(selectedDistrict)}${
          selectedRegion ? ` | Region: ${prettyLabel(selectedRegion)}` : ""
        }`
      : `Selected District: All assigned districts${
          selectedRegion ? ` | Region: ${prettyLabel(selectedRegion)}` : ""
        }`
  );
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const p = getParams();
  selector.value = "dm";

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
    if (p.districtId) next.searchParams.set("district", p.districtId);
    if (p.storeId && view === "sm") next.searchParams.set("store", p.storeId);

    window.location.href = next.toString();
  });
}

/* =========================================================
   Rendering
========================================================= */

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <h2>${title}</h2>
      <div class="meta">${line1}</div>
      ${line2 ? `<div class="meta" style="margin-top:8px;">${line2}</div>` : ""}
    </div>
  `);
}

function renderLiveDistrict(truth) {
  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;
  const base = truth.baselineWeeklyKpis || {};

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
    const k = row.latestWeekKpis || {};
    const b = row.baselineWeeklyKpis || {};
    const p = row.previousWeekKpis || null;

    const wowSales = p ? (k.sales - p.sales) : NaN;
    const wowTx = p ? (k.transactions - p.transactions) : NaN;
    const wowLabor =
      p && isFinite(p.laborPct) && isFinite(k.laborPct)
        ? (k.laborPct - p.laborPct)
        : NaN;

    const salesVsBase = pctDelta(k.sales, b.sales);
    const txVsBase = pctDelta(k.transactions, b.transactions);

    return `
      <tr>
        <td><b>${prettyLabel(row.label)}</b></td>
        <td>${fmtNumber(row.counts?.stores || 0)}</td>
        <td>${k ? fmtMoney(k.sales) : "—"}</td>
        <td>${k ? fmtNumber(k.transactions) : "—"}</td>
        <td>${k ? fmtPct(k.laborPct) : "—"}</td>
        <td>${k ? fmtMoney2(k.avgTicket) : "—"}</td>
        <td class="${deltaClass(wowSales, "up")}">${p ? fmtDeltaMoney0(wowSales) : "—"}</td>
        <td class="${deltaClass(wowTx, "up")}">${p ? fmtDeltaNumber0(wowTx) : "—"}</td>
        <td class="${deltaClass(wowLabor, "down")}">${p ? fmtDeltaPct(wowLabor) : "—"}</td>
        <td class="${isFinite(salesVsBase) ? (salesVsBase >= 0 ? "good" : "bad") : ""}">
          ${isFinite(salesVsBase) ? salesVsBase.toFixed(1) + "%" : "—"}
        </td>
        <td class="${isFinite(txVsBase) ? (txVsBase >= 0 ? "good" : "bad") : ""}">
          ${isFinite(txVsBase) ? txVsBase.toFixed(1) + "%" : "—"}
        </td>
        <td>
          <button class="drill-btn" type="button" data-store-id="${row.key}">Open Store</button>
        </td>
      </tr>
    `;
  }).join("");

  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <h2>District Rollup — ${prettyLabel(truth.scopeDistrictId || "Selected District")}</h2>
      <div class="meta">
        Latest approved district performance is aggregated from all active stores in scope.
      </div>
      <div class="meta" style="margin-top:8px;">
        Live Stores: <b>${fmtNumber(truth.counts?.storesLive || 0)}</b> |
        Baseline Stores: <b>${fmtNumber(truth.counts?.storesWithBaseline || 0)}</b> |
        Latest Week: <b>${latestWeekLabel}</b>
      </div>
    </div>

    <div class="cdm-grid">
      ${metricCard(
        "District Sales",
        fmtMoney(current.sales),
        prev ? `${fmtDeltaMoney0(salesDelta)} vs previous week` : "No previous-week comparison yet",
        salesCls
      )}
      ${metricCard(
        "District Transactions",
        fmtNumber(current.transactions),
        prev ? `${fmtDeltaNumber0(txDelta)} vs previous week` : "No previous-week comparison yet",
        txCls
      )}
      ${metricCard(
        "District Labor %",
        fmtPct(current.laborPct),
        prev ? `${fmtDeltaPct(laborPctDelta)} vs previous week` : "No previous-week comparison yet",
        laborCls
      )}
      ${metricCard(
        "District Avg Ticket",
        fmtMoney2(current.avgTicket),
        prev ? `${fmtDeltaMoney2(avgTicketDelta)} vs previous week` : "No previous-week comparison yet",
        avgTicketCls
      )}
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3>District Interpretation</h3>
      <div class="meta" style="margin-top:8px;">
        Baseline weekly equivalent remains the reference point, while week-over-week movement is used to monitor district trend direction.
      </div>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
        <div>• Baseline Weekly Sales: ${fmtMoney(base.sales)}</div>
        <div>• Baseline Weekly Transactions: ${fmtNumber(base.transactions)}</div>
        <div>• Baseline Labor %: ${fmtPct(base.laborPct)}</div>
        <div>• Baseline Avg Ticket: ${fmtMoney2(base.avgTicket)}</div>
      </div>
    </div>

    <div class="card">
      <h3>Store Rollup Table</h3>
      <div class="meta" style="margin-top:8px;">
        Click a store to drill into the store manager view.
      </div>

      <div class="cdm-table-wrap">
        <table data-dm-store-table>
          <thead>
            <tr>
              <th>Store</th>
              <th>Units</th>
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
          <tbody>${rowsHtml || `<tr><td colspan="12">No store rows found.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `);
}

async function loadDistrictRollup() {
  try {
    const truth = await loadCommercialRollupTruth();

    if (truth.state === "missing_context") {
      renderLocked("District Rollup", "Missing org context.");
      return;
    }

    if (truth.state === "no_stores") {
      renderLocked("District Rollup", "No stores found in this district scope.");
      return;
    }

    if (truth.state === "missing_baseline") {
      renderLocked(
        `District Rollup — ${prettyLabel(truth.scopeDistrictId || "Selected District")}`,
        "No approved baseline found in this district scope."
      );
      return;
    }

    if (truth.state === "baseline_only") {
      renderLocked(
        `District Rollup — ${prettyLabel(truth.scopeDistrictId || "Selected District")}`,
        "Approved baselines found, but no approved weekly uploads exist yet in this district scope."
      );
      return;
    }

    renderLiveDistrict(truth);
    setupDMTableActions();
  } catch (e) {
    console.error("[commercial-dm] load failed:", e);
    renderLocked("District Rollup", "Unable to load district rollup right now.");
  }
}

/* =========================================================
   Drill-down table actions
========================================================= */

function setupDMTableActions() {
  const table = document.querySelector("[data-dm-store-table]");
  if (!table) return;

  const p = getParams();

  table.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-store-id]");
    if (!trigger) return;

    const storeId = String(trigger.getAttribute("data-store-id") || "").trim();
    if (!storeId) return;

    const next = new URL("./commercial-portal.html", window.location.href);
    if (p.orgId) next.searchParams.set("org", p.orgId);
    if (p.regionId) next.searchParams.set("region", p.regionId);
    if (p.districtId) next.searchParams.set("district", p.districtId);
    next.searchParams.set("store", storeId);

    window.location.href = next.toString();
  });
}

/* =========================================================
   Init
========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  setDMHeaderContext();
  setupViewSelector();
  await loadDistrictRollup();
});