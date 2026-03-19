// /assets/commercial-kpis.js (v1)
// Commercial KPIs
// ✅ Uses commercial approved baseline + latest approved week
// ✅ Uses shared KPI engine math
// ✅ Shows previous-week comparison when available
// 🚫 No KPI math changes

import { loadCommercialStoreTruth, getCommercialScopeFromUrl, getCommercialSessionContext } from "./commercial-kpi-data.js";
import { fmtMoney, fmtMoney2, fmtNumber, fmtPct, deltaClass } from "./core-kpi-engine.js";

const ROOT_ID = "commercialKpisRoot";
const $ = (id) => document.getElementById(id);

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
  const s = abs.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return `${sign(v)}${s.replace("-", "")}`;
}

function fmtDeltaMoney2(d) {
  const v = Number(d);
  if (!isFinite(v) || v === 0) return "0";
  const abs = Math.abs(v);
  const s = abs.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
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

function injectStyles() {
  if (document.getElementById("commercialKpiStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialKpiStyles";
  style.textContent = `
    #${ROOT_ID} .ckpi-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:14px;
      margin-bottom:18px;
    }

    #${ROOT_ID} .ckpi-card{
      min-width:220px;
      flex:1;
    }

    #${ROOT_ID} .small{
      font-size:12px;
      opacity:.8;
      margin-bottom:6px;
    }

    #${ROOT_ID} .ckpi-value{
      font-size:28px;
      font-weight:700;
      margin-top:8px;
    }

    #${ROOT_ID} .ckpi-delta{
      margin-top:8px;
      opacity:.9;
    }

    #${ROOT_ID} .good{
      color: rgba(46,204,113,.95);
    }

    #${ROOT_ID} .bad{
      color: rgba(239,68,68,.95);
    }
  `;
  document.head.appendChild(style);
}

function setupHeader() {
  const { orgId, role } = getCommercialSessionContext();
  const { storeId, districtId, regionId } = getCommercialScopeFromUrl();

  setText("kpiContext", `Org: ${orgId || "N/A"} | Role: ${role || "N/A"} | Commercial KPIs`);

  let scopeText = "Scope: Assigned commercial access";
  if (storeId) scopeText = `Scope: Store — ${prettyLabel(storeId)}`;
  else if (districtId) scopeText = `Scope: District — ${prettyLabel(districtId)}`;
  else if (regionId) scopeText = `Scope: Region — ${prettyLabel(regionId)}`;

  setText("kpiScope", scopeText);
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const { storeId, districtId, regionId } = getCommercialScopeFromUrl();
  selector.value = "sm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      window.location.href = "./commercial-vp.html";
      return;
    }

    if (view === "rm") {
      if (regionId) {
        window.location.href = `./commercial-rm.html?region=${encodeURIComponent(regionId)}`;
      } else {
        window.location.href = "./commercial-rm.html";
      }
      return;
    }

    if (view === "dm") {
      const next = new URL("./commercial-dm.html", window.location.href);
      if (districtId) next.searchParams.set("district", districtId);
      if (regionId) next.searchParams.set("region", regionId);
      window.location.href = next.toString();
      return;
    }

    if (view === "sm") {
      const next = new URL("./commercial-kpis.html", window.location.href);
      if (storeId) next.searchParams.set("store", storeId);
      if (districtId) next.searchParams.set("district", districtId);
      if (regionId) next.searchParams.set("region", regionId);
      window.location.href = next.toString();
    }
  });
}

function setupLogout() {
  $("logoutBtn")?.addEventListener("click", () => {
    try {
      localStorage.removeItem("FLQSR_COMM_SESSION");
    } catch {}
    window.location.href = "./commercial-login.html";
  });
}

function metricCard(title, value, deltaText, deltaCls) {
  return `
    <div class="card ckpi-card">
      <div class="small">${title}</div>
      <div class="ckpi-value">${value}</div>
      <div class="ckpi-delta ${deltaCls || ""}">${deltaText || "—"}</div>
    </div>
  `;
}

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <h2>${title}</h2>
      <div class="meta">${line1}</div>
      ${line2 ? `<div class="meta" style="margin-top:8px;opacity:.85;">${line2}</div>` : ""}
    </div>
  `);
}

async function renderCommercialKpis() {
  const truth = await loadCommercialStoreTruth();

  if (truth.state === "missing_context") {
    renderLocked(
      "Commercial KPIs",
      "Missing org or store context.",
      "Open this page with a valid commercial store selected."
    );
    return;
  }

  if (truth.state === "pending_baseline") {
    renderLocked(
      `Commercial KPIs — ${prettyLabel(truth.storeId)}`,
      "A pending baseline exists, but it is not approved yet.",
      "Approve the commercial baseline before interpreting weekly KPI movement."
    );
    return;
  }

  if (truth.state === "missing_baseline") {
    renderLocked(
      `Commercial KPIs — ${prettyLabel(truth.storeId)}`,
      "No approved baseline found for this store.",
      "Upload and approve a commercial baseline first."
    );
    return;
  }

  if (truth.state === "baseline_only") {
    const base = truth.baselineWeeklyKpis;
    setHtml(ROOT_ID, `
      <div class="card" style="margin-bottom:18px;">
        <h2>Commercial KPIs — ${prettyLabel(truth.storeId)}</h2>
        <div class="meta">Approved baseline found. No approved weekly upload exists yet.</div>
        <div class="meta" style="margin-top:8px;opacity:.85;">
          Baseline Reference: <b>${truth.baselineStatus?.activeBaseline?.label || truth.baselineStatus?.activeBaseline?.year || "Approved baseline"}</b>
        </div>
      </div>

      <div class="ckpi-grid">
        ${metricCard("Baseline Weekly Sales", fmtMoney(base?.sales), "Awaiting weekly upload", "")}
        ${metricCard("Baseline Weekly Transactions", fmtNumber(base?.transactions), "Awaiting weekly upload", "")}
        ${metricCard("Baseline Labor %", fmtPct(truth.baselineMonthKpis?.laborPct), "Awaiting weekly upload", "")}
        ${metricCard("Baseline Avg Ticket", fmtMoney2(truth.baselineMonthKpis?.avgTicket), "Awaiting weekly upload", "")}
      </div>
    `);
    return;
  }

  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;

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

  const salesDeltaText = prev ? `${fmtDeltaMoney0(salesDelta)} vs previous week` : "No previous-week comparison yet";
  const txDeltaText = prev ? `${fmtDeltaNumber0(txDelta)} vs previous week` : "No previous-week comparison yet";
  const laborDeltaText = prev ? `${fmtDeltaPct(laborPctDelta)} vs previous week` : "No previous-week comparison yet";
  const avgTicketDeltaText = prev ? `${fmtDeltaMoney2(avgTicketDelta)} vs previous week` : "No previous-week comparison yet";

  const salesCls = deltaClass(salesDelta, "up");
  const txCls = deltaClass(txDelta, "up");
  const laborCls = deltaClass(laborPctDelta, "down");
  const avgTicketCls = deltaClass(avgTicketDelta, "up");

  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <h2>Commercial KPIs — ${prettyLabel(truth.storeId)}</h2>
      <div class="meta">
        Weekly KPI view is built from the approved latest weekly upload for the selected commercial store.
      </div>
      <div class="meta" style="margin-top:8px;opacity:.85;">
        Baseline: <b>${truth.baselineStatus?.activeBaseline?.label || truth.baselineStatus?.activeBaseline?.year || "Approved baseline"}</b>
        &nbsp;|&nbsp;
        Latest Week: <b>${truth.latestWeek?.weekStart || "Approved week"}</b>
      </div>
    </div>

    <div class="ckpi-grid">
      ${metricCard("Sales", fmtMoney(current.sales), salesDeltaText, salesCls)}
      ${metricCard("Transactions", fmtNumber(current.transactions), txDeltaText, txCls)}
      ${metricCard("Labor %", fmtPct(current.laborPct), laborDeltaText, laborCls)}
      ${metricCard("Avg Ticket", fmtMoney2(current.avgTicket), avgTicketDeltaText, avgTicketCls)}
    </div>

    <div class="card">
      <h3>Weekly Interpretation</h3>
      <div class="meta" style="margin-top:8px;">
        This view compares the latest approved commercial week against the previous approved week for the same store.
      </div>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
        <div>• Sales: ${fmtMoney(current.sales)}</div>
        <div>• Transactions: ${fmtNumber(current.transactions)}</div>
        <div>• Labor %: ${fmtPct(current.laborPct)}</div>
        <div>• Avg Ticket: ${fmtMoney2(current.avgTicket)}</div>
      </div>
    </div>
  `);
}

window.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  setupHeader();
  setupViewSelector();
  setupLogout();
  await renderCommercialKpis();
});