// /assets/commercial-rm.js (v6)
// Regional Manager page logic
// ✅ Uses commercial-rollup-data.js
// ✅ Aggregates region totals from store-level approved truth
// ✅ Shows district drill-down table
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
    <div class="card">
      <div class="small">${title}</div>
      <div class="crm-value">${value}</div>
      <div class="crm-delta ${deltaCls || ""}">${deltaText || "—"}</div>
    </div>
  `;
}

/* =========================================================
   Styles
========================================================= */

function injectStyles() {
  if (document.getElementById("commercialRmStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialRmStyles";
  style.textContent = `
    #${ROOT_ID}{
      color:#0f172a;
    }

    #${ROOT_ID} .crm-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:14px;
      margin-bottom:18px;
    }

    #${ROOT_ID} .crm-value{
      font-size:28px;
      font-weight:900;
      margin-top:8px;
      color:#0f172a;
      line-height:1.05;
    }

    #${ROOT_ID} .crm-delta{
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

    #${ROOT_ID} .crm-table-wrap{
      overflow:auto;
      margin-top:12px;
      border:1px solid rgba(15,23,42,.08);
      border-radius:12px;
      background:#fff;
    }

    #${ROOT_ID} table{
      width:100%;
      min-width:840px;
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

function renderLiveRegion(truth) {
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
          <button class="drill-btn" type="button" data-district-id="${row.key}">Open District</button>
        </td>
      </tr>
    `;
  }).join("");

  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <h2>Region Rollup — ${prettyLabel(truth.scopeRegionId || "Selected Region")}</h2>
      <div class="meta">
        Latest approved regional performance is aggregated from all active stores in scope.
      </div>
      <div class="meta" style="margin-top:8px;">
        Live Stores: <b>${fmtNumber(truth.counts?.storesLive || 0)}</b> |
        Baseline Stores: <b>${fmtNumber(truth.counts?.storesWithBaseline || 0)}</b> |
        Latest Week: <b>${latestWeekLabel}</b>
      </div>
    </div>

    <div class="crm-grid">
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

    <div class="card" style="margin-bottom:18px;">
      <h3>Regional Interpretation</h3>
      <div class="meta" style="margin-top:8px;">
        Baseline weekly equivalent remains the reference point, while week-over-week movement is used to monitor regional trend direction.
      </div>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
        <div>• Baseline Weekly Sales: ${fmtMoney(base.sales)}</div>
        <div>• Baseline Weekly Transactions: ${fmtNumber(base.transactions)}</div>
        <div>• Baseline Labor %: ${fmtPct(base.laborPct)}</div>
        <div>• Baseline Avg Ticket: ${fmtMoney2(base.avgTicket)}</div>
      </div>
    </div>

    <div class="card">
      <h3>District Rollup Table</h3>
      <div class="meta" style="margin-top:8px;">
        Click a district to drill into the district manager view.
      </div>

      <div class="crm-table-wrap">
        <table data-rm-district-table>
          <thead>
            <tr>
              <th>District</th>
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
          <tbody>${rowsHtml || `<tr><td colspan="12">No district rows found.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `);
}

async function loadRegionRollup() {
  try {
    const truth = await loadCommercialRollupTruth();

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

    renderLiveRegion(truth);
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
  injectStyles();
  setRMHeaderContext();
  setupViewSelector();
  await loadRegionRollup();
});