// /assets/commercial-kpis.js (v4)
// Commercial KPIs — unified light-card commercial design
// ✅ Uses commercial-kpi-data.js shared adapter
// ✅ Uses approved baseline + latest approved week + previous week
// ✅ Falls back to session org/store when URL context is incomplete
// ✅ Uses shared commercial styles direction
// 🚫 No KPI math changes

import { loadCommercialStoreTruth } from "./commercial-kpi-data.js";
import {
  fmtMoney,
  fmtMoney2,
  fmtNumber,
  fmtPct,
  deltaClass
} from "./core-kpi-engine.js";

const ROOT_ID = "commercialKpisRoot";
const $ = (id) => document.getElementById(id);

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
    storeId: String(params.get("store") || "").trim(),
    districtId: String(params.get("district") || "").trim(),
    regionId: String(params.get("region") || "").trim()
  };
}

function getResolvedContext() {
  const s = readSession() || {};
  const p = getParams();

  const sessionOrgId = String(s.orgId || "").trim();
  const sessionStores = Array.isArray(s.assigned_store_ids) ? s.assigned_store_ids : [];
  const sessionStoreId = String(sessionStores[0] || "").trim();

  return {
    orgId: p.orgId || sessionOrgId,
    storeId: p.storeId || sessionStoreId,
    districtId: p.districtId,
    regionId: p.regionId
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

function injectStyles() {
  if (document.getElementById("commercialKpiStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialKpiStyles";
  style.textContent = `
    #${ROOT_ID}{
      color:#0f172a;
    }

    #${ROOT_ID} .ckpi-hero{
      margin-bottom:18px;
    }

    #${ROOT_ID} .ckpi-grid{
      display:grid;
      grid-template-columns:repeat(4, minmax(0, 1fr));
      gap:14px;
      margin-bottom:18px;
    }

    #${ROOT_ID} .ckpi-card{
      background:#f8fafc;
      border:1px solid rgba(15,23,42,.08);
      border-radius:14px;
      padding:16px;
      min-height:118px;
      color:#0f172a;
      box-shadow:0 8px 24px rgba(15,23,42,.05);
    }

    #${ROOT_ID} .ckpi-label{
      margin:0 0 8px;
      font-size:13px;
      line-height:1.4;
      color:rgba(15,23,42,.68);
      font-weight:700;
    }

    #${ROOT_ID} .ckpi-value{
      margin:0;
      font-size:28px;
      line-height:1;
      font-weight:900;
      color:#0f172a;
    }

    #${ROOT_ID} .ckpi-delta{
      margin:10px 0 0;
      font-size:13px;
      line-height:1.45;
      font-weight:800;
    }

    #${ROOT_ID} .ckpi-list{
      margin-top:12px;
      display:flex;
      flex-direction:column;
      gap:8px;
      color:rgba(15,23,42,.78);
      font-size:14px;
      line-height:1.5;
    }

    #${ROOT_ID} .ckpi-meta-strong{
      color:#0f172a;
      font-weight:800;
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

    @media (max-width: 980px){
      #${ROOT_ID} .ckpi-grid{
        grid-template-columns:repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px){
      #${ROOT_ID} .ckpi-grid{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function setHeaderContext() {
  const s = readSession() || {};
  const ctx = getResolvedContext();

  const role = String(s.role || "sm").toUpperCase();
  const orgId = ctx.orgId || s.orgId || "N/A";
  const selectedStore = ctx.storeId;
  const selectedDistrict = ctx.districtId;
  const selectedRegion = ctx.regionId;

  setText("kpiContext", `Org: ${orgId} | Role: ${role} | KPIs`);

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

  setText("kpiScope", scopeText);
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const ctx = getResolvedContext();
  selector.value = "sm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      const next = new URL("./commercial-vp.html", window.location.href);
      if (ctx.orgId) next.searchParams.set("org", ctx.orgId);
      if (ctx.regionId) next.searchParams.set("region", ctx.regionId);
      if (ctx.districtId) next.searchParams.set("district", ctx.districtId);
      if (ctx.storeId) next.searchParams.set("store", ctx.storeId);
      window.location.href = next.toString();
      return;
    }

    if (view === "rm") {
      const next = new URL("./commercial-rm.html", window.location.href);
      if (ctx.orgId) next.searchParams.set("org", ctx.orgId);
      if (ctx.regionId) next.searchParams.set("region", ctx.regionId);
      if (ctx.districtId) next.searchParams.set("district", ctx.districtId);
      if (ctx.storeId) next.searchParams.set("store", ctx.storeId);
      window.location.href = next.toString();
      return;
    }

    if (view === "dm") {
      const next = new URL("./commercial-dm.html", window.location.href);
      if (ctx.orgId) next.searchParams.set("org", ctx.orgId);
      if (ctx.districtId) next.searchParams.set("district", ctx.districtId);
      if (ctx.regionId) next.searchParams.set("region", ctx.regionId);
      if (ctx.storeId) next.searchParams.set("store", ctx.storeId);
      window.location.href = next.toString();
      return;
    }

    const next = new URL("./commercial-kpis.html", window.location.href);
    if (ctx.orgId) next.searchParams.set("org", ctx.orgId);
    if (ctx.storeId) next.searchParams.set("store", ctx.storeId);
    if (ctx.districtId) next.searchParams.set("district", ctx.districtId);
    if (ctx.regionId) next.searchParams.set("region", ctx.regionId);
    window.location.href = next.toString();
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

function metricCard(title, value, deltaText, deltaCls) {
  return `
    <div class="ckpi-card">
      <div class="ckpi-label">${title}</div>
      <div class="ckpi-value">${value}</div>
      <div class="ckpi-delta ${deltaCls || "pending"}">${deltaText || "—"}</div>
    </div>
  `;
}

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <div class="card ckpi-hero">
      <h2>${title}</h2>
      <div class="meta">${line1}</div>
      ${line2 ? `<div class="meta" style="margin-top:8px;">${line2}</div>` : ""}
    </div>
  `);
}

function renderLiveKpis(truth) {
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

  const baselineLabel =
    truth.baselineStatus?.activeBaseline?.label ||
    truth.baselineStatus?.activeBaseline?.year ||
    "Approved baseline";

  const latestWeekLabel = truth.latestWeek?.weekStart || "Approved week";

  setHtml(ROOT_ID, `
    <div class="card ckpi-hero">
      <h2>KPIs — ${prettyLabel(truth.storeId)}</h2>
      <div class="meta">
        Weekly KPI view is built from the latest approved weekly upload for the selected store.
      </div>
      <div class="meta" style="margin-top:8px;">
        Baseline: <span class="ckpi-meta-strong">${baselineLabel}</span> | Latest Week: <span class="ckpi-meta-strong">${latestWeekLabel}</span>
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
        This view compares the latest approved week against the previous approved week for the same store.
      </div>

      <div class="ckpi-list">
        <div>• Sales: ${fmtMoney(current.sales)}</div>
        <div>• Transactions: ${fmtNumber(current.transactions)}</div>
        <div>• Labor %: ${fmtPct(current.laborPct)}</div>
        <div>• Avg Ticket: ${fmtMoney2(current.avgTicket)}</div>
      </div>
    </div>
  `);
}

async function loadCommercialKpis() {
  try {
    const ctx = getResolvedContext();

    const truth = await loadCommercialStoreTruth({
      storeId: ctx.storeId
    });

    if (truth.state === "missing_context") {
      renderLocked(
        "KPIs",
        "Missing org or store context.",
        "This page supports session fallback, so if this still appears, the session likely does not have a valid org/store assignment."
      );
      return;
    }

    if (truth.state === "pending_baseline") {
      renderLocked(
        `KPIs — ${prettyLabel(truth.storeId)}`,
        "A pending baseline exists, but it is not approved yet.",
        "Approve the baseline before interpreting weekly KPI movement."
      );
      return;
    }

    if (truth.state === "missing_baseline") {
      renderLocked(
        `KPIs — ${prettyLabel(truth.storeId)}`,
        "No approved baseline found for this store."
      );
      return;
    }

    if (truth.state === "baseline_only") {
      const baseWeekly = truth.baselineWeeklyKpis || {};
      const baseMonth = truth.baselineMonthKpis || {};
      const baselineLabel =
        truth.baselineStatus?.activeBaseline?.label ||
        truth.baselineStatus?.activeBaseline?.year ||
        "Approved baseline";

      setHtml(ROOT_ID, `
        <div class="card ckpi-hero">
          <h2>KPIs — ${prettyLabel(truth.storeId)}</h2>
          <div class="meta">Approved baseline found. No approved weekly upload exists yet.</div>
          <div class="meta" style="margin-top:8px;">
            Baseline Reference: <span class="ckpi-meta-strong">${baselineLabel}</span>
          </div>
        </div>

        <div class="ckpi-grid">
          ${metricCard("Baseline Weekly Sales", fmtMoney(baseWeekly.sales), "Awaiting weekly upload", "pending")}
          ${metricCard("Baseline Weekly Transactions", fmtNumber(baseWeekly.transactions), "Awaiting weekly upload", "pending")}
          ${metricCard("Baseline Labor %", fmtPct(baseMonth.laborPct), "Awaiting weekly upload", "pending")}
          ${metricCard("Baseline Avg Ticket", fmtMoney2(baseMonth.avgTicket), "Awaiting weekly upload", "pending")}
        </div>
      `);
      return;
    }

    renderLiveKpis(truth);
  } catch (e) {
    console.error("[commercial-kpis] load failed:", e);
    renderLocked("KPIs", "Unable to load KPI data right now.");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  setHeaderContext();
  setupViewSelector();
  setupLogout();
  await loadCommercialKpis();
});