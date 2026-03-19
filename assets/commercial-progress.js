// /assets/commercial-progress.js (v3)
// Commercial Progress — live weekly trend
// ✅ Uses commercial-kpi-data.js
// ✅ Resolves active store from URL, session, localStorage, or assigned stores
// ✅ Baseline weekly equivalent vs all approved weeks
// ✅ Real WoW + trend visibility
// 🚫 No KPI math changes

import { loadCommercialStoreTruth } from "./commercial-kpi-data.js";

const ROOT_ID = "commercialProgressRoot";
const $ = (id) => document.getElementById(id);

const LS_COMM_ACTIVE_STORE = "FLQSR_COMM_ACTIVE_STORE_ID";

/* ---------------- session / scope helpers ---------------- */

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

function getStoreFromUrl() {
  return getUrlParam("store");
}

function getDistrictFromUrl() {
  return getUrlParam("district");
}

function getRegionFromUrl() {
  return getUrlParam("region");
}

function normStoreId(v) {
  return String(v || "").trim();
}

function getAssignedStoresFromSession() {
  const s = readSession();
  if (!s) return [];
  const arr = Array.isArray(s.assigned_store_ids) ? s.assigned_store_ids : [];
  return arr.map(normStoreId).filter(Boolean);
}

function getSessionSelectedStore() {
  const s = readSession();
  if (!s) return "";
  return String(
    s.selectedStoreId ||
    s.activeStoreId ||
    s.storeId ||
    ""
  ).trim();
}

function getStoredActiveStore() {
  try {
    return String(
      localStorage.getItem(LS_COMM_ACTIVE_STORE) ||
      localStorage.getItem("FLQSR_ACTIVE_STORE_ID") ||
      localStorage.getItem("flqsr_active_store_id") ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

function setStoredActiveStore(storeId) {
  const v = String(storeId || "").trim();
  if (!v) return;
  try { localStorage.setItem(LS_COMM_ACTIVE_STORE, v); } catch {}
}

function resolveSelectedStore() {
  const fromUrl = getStoreFromUrl();
  if (fromUrl) return fromUrl;

  const fromSession = getSessionSelectedStore();
  if (fromSession) return fromSession;

  const fromLs = getStoredActiveStore();
  if (fromLs) return fromLs;

  const assigned = getAssignedStoresFromSession();
  if (assigned.length) return assigned[0];

  return "";
}

/* ---------------- header / nav helpers ---------------- */

function prettyLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, m => m.toUpperCase());
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function setHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "sm").toUpperCase();
  const orgId = s.orgId || "N/A";

  const selectedStore = resolveSelectedStore();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  setText("progContext", `Org: ${orgId} | Role: ${role} | Commercial Progress`);

  let scopeText = "Scope: Assigned commercial access";
  if (selectedStore) {
    scopeText = `Scope: Store — ${prettyLabel(selectedStore)}`;
  } else if (selectedDistrict) {
    scopeText = `Scope: District — ${prettyLabel(selectedDistrict)}`;
  } else if (selectedRegion) {
    scopeText = `Scope: Region — ${prettyLabel(selectedRegion)}`;
  } else {
    scopeText = "Scope: Organization / assigned commercial access";
  }

  setText("progScope", scopeText);
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const selectedStore = resolveSelectedStore();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  selector.value = "sm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      window.location.href = "./commercial-vp.html";
      return;
    }

    if (view === "rm") {
      const next = new URL("./commercial-rm.html", window.location.href);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      window.location.href = next.toString();
      return;
    }

    if (view === "dm") {
      const next = new URL("./commercial-dm.html", window.location.href);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      window.location.href = next.toString();
      return;
    }

    if (view === "sm") {
      const next = new URL("./commercial-progress.html", window.location.href);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      window.location.href = next.toString();
    }
  });
}

function setupLogout() {
  $("logoutBtn")?.addEventListener("click", () => {
    try {
      localStorage.removeItem("FLQSR_COMM_SESSION");
      localStorage.removeItem(LS_COMM_ACTIVE_STORE);
    } catch {}
    window.location.href = "./commercial-login.html";
  });
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

    #${ROOT_ID} .progSection{
      margin-top:14px;
    }

    #${ROOT_ID} .progGrid3{
      display:grid;
      grid-template-columns:repeat(3, minmax(0,1fr));
      gap:12px;
    }

    #${ROOT_ID} .progMetric{
      padding:12px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
    }

    #${ROOT_ID} .progMetricLabel{
      font-size:12px;
      opacity:.72;
      margin-bottom:6px;
    }

    #${ROOT_ID} .progMetricValue{
      font-size:24px;
      font-weight:900;
      line-height:1.15;
    }

    #${ROOT_ID} .progMetricSub{
      margin-top:8px;
      font-size:13px;
      opacity:.82;
    }

    #${ROOT_ID} .progHeatTable{
      width:100%;
      min-width:640px;
      border-collapse:collapse;
    }

    #${ROOT_ID} .progHeatTable th,
    #${ROOT_ID} .progHeatTable td{
      padding:10px 12px;
      border-bottom:1px solid rgba(255,255,255,.06);
      text-align:left;
      font-size:13px;
    }

    #${ROOT_ID} .progHeatTable th{
      font-weight:900;
      background:rgba(0,0,0,.12);
    }

    #${ROOT_ID} .progHeatCell{
      width:46px;
      height:28px;
      border-radius:8px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-size:12px;
      font-weight:900;
      border:1px solid rgba(255,255,255,.08);
    }

    #${ROOT_ID} .heat-good{
      background:rgba(46,204,113,.18);
      color:rgba(46,204,113,.98);
    }

    #${ROOT_ID} .heat-watch{
      background:rgba(245,158,11,.18);
      color:rgba(245,158,11,.98);
    }

    #${ROOT_ID} .heat-bad{
      background:rgba(239,68,68,.18);
      color:rgba(239,68,68,.98);
    }

    @media (max-width: 900px){
      #${ROOT_ID} .progGrid3{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ---------------- helpers ---------------- */

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

/* ---------------- KPI calc ---------------- */

function computeKpis(rows) {
  let sales = 0;
  let tx = 0;
  let labor = 0;

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
    const k = computeKpis(w.rows || []);
    const prev = weeks[i - 1] ? computeKpis(weeks[i - 1].rows || []) : null;

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

  const heatRows = rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td><span class="progHeatCell ${heatClass(r.vsBase.sales)}">${r.vsBase.sales.toFixed(1)}%</span></td>
      <td><span class="progHeatCell ${heatClass(r.vsBase.tx)}">${r.vsBase.tx.toFixed(1)}%</span></td>
      <td><span class="progHeatCell ${heatClass(r.vsBase.labor)}">${r.vsBase.labor.toFixed(2)}</span></td>
    </tr>
  `).join("");

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
  const resolvedStore = resolveSelectedStore();
  if (resolvedStore) setStoredActiveStore(resolvedStore);

  try {
    const truth = await loadCommercialStoreTruth({
      storeId: resolvedStore
    });

    if (truth?.storeId) setStoredActiveStore(truth.storeId);

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

window.addEventListener("DOMContentLoaded", () => {
  injectStyles();
  setHeaderContext();
  setupViewSelector();
  setupLogout();
  load();
});