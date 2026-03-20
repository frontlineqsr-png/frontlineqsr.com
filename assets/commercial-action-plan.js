// /assets/commercial-action-plan.js (v5)
// Commercial Action Plan — unified light-card commercial design
// ✅ Uses commercial-kpi-data.js shared adapter
// ✅ Resolves active store from URL, session, localStorage, or assigned stores
// ✅ Uses approved baseline + latest approved week
// ✅ Includes labor points + labor dollar impact
// ✅ Matches commercial light-card system
// 🚫 No KPI math changes

import { loadCommercialStoreTruth } from "./commercial-kpi-data.js";

const ROOT_ID = "commercialActionPlanRoot";
const $ = (id) => document.getElementById(id);

const LS_COMM_ACTIVE_STORE = "FLQSR_COMM_ACTIVE_STORE_ID";

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

function prettyLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
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
  return String(s.selectedStoreId || s.activeStoreId || s.storeId || "").trim();
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

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function injectStyles() {
  if (document.getElementById("commercialActionPlanStyles")) return;

  const style = document.createElement("style");
  style.id = "commercialActionPlanStyles";
  style.textContent = `
    #${ROOT_ID}{
      color:#0f172a;
    }

    #${ROOT_ID} .cap-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
      border:1px solid rgba(15,23,42,.10);
      background:rgba(15,23,42,.05);
      color:#0f172a;
    }

    #${ROOT_ID} .cap-grid-3{
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:12px;
    }

    #${ROOT_ID} .cap-grid-2{
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:12px;
    }

    #${ROOT_ID} .cap-metric{
      padding:14px;
      border-radius:12px;
      background:#f8fafc;
      border:1px solid rgba(15,23,42,.08);
      box-shadow:0 8px 24px rgba(15,23,42,.05);
      color:#0f172a;
    }

    #${ROOT_ID} .cap-metric-value{
      font-weight:900;
      font-size:22px;
      line-height:1.3;
      color:#0f172a;
    }

    #${ROOT_ID} .cap-action-box{
      padding:14px;
      border-radius:12px;
      background:#f8fafc;
      border:1px solid rgba(15,23,42,.08);
      box-shadow:0 8px 24px rgba(15,23,42,.05);
      color:#0f172a;
    }

    #${ROOT_ID} .cap-action-text{
      font-weight:700;
      line-height:1.5;
      color:#0f172a;
    }

    #${ROOT_ID} .small{
      font-size:12px;
      line-height:1.4;
      color:rgba(15,23,42,.62);
      margin-bottom:6px;
      font-weight:700;
    }

    #${ROOT_ID} .meta{
      font-size:14px;
      line-height:1.5;
      color:rgba(15,23,42,.74);
    }

    #${ROOT_ID} .cap-bullet-list{
      display:flex;
      flex-direction:column;
      gap:7px;
      margin-top:10px;
      color:rgba(15,23,42,.82);
      line-height:1.5;
    }

    @media (max-width: 720px){
      #${ROOT_ID} .cap-grid-3,
      #${ROOT_ID} .cap-grid-2{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function setHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "sm").toUpperCase();
  const orgId = s.orgId || "N/A";

  const selectedStore = resolveSelectedStore();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();

  setText("apContext", `Org: ${orgId} | Role: ${role} | Action Plan`);

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

  setText("apScope", scopeText);
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const selectedStore = resolveSelectedStore();
  const selectedDistrict = getDistrictFromUrl();
  const selectedRegion = getRegionFromUrl();
  const orgId = String(readSession()?.orgId || "").trim();

  selector.value = "sm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      const next = new URL("./commercial-vp.html", window.location.href);
      if (orgId) next.searchParams.set("org", orgId);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      window.location.href = next.toString();
      return;
    }

    if (view === "rm") {
      const next = new URL("./commercial-rm.html", window.location.href);
      if (orgId) next.searchParams.set("org", orgId);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      window.location.href = next.toString();
      return;
    }

    if (view === "dm") {
      const next = new URL("./commercial-dm.html", window.location.href);
      if (orgId) next.searchParams.set("org", orgId);
      if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
      if (selectedRegion) next.searchParams.set("region", selectedRegion);
      if (selectedStore) next.searchParams.set("store", selectedStore);
      window.location.href = next.toString();
      return;
    }

    const next = new URL("./commercial-action-plan.html", window.location.href);
    if (orgId) next.searchParams.set("org", orgId);
    if (selectedStore) next.searchParams.set("store", selectedStore);
    if (selectedDistrict) next.searchParams.set("district", selectedDistrict);
    if (selectedRegion) next.searchParams.set("region", selectedRegion);
    window.location.href = next.toString();
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

function money0(x) {
  const n = Number(x || 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct1(x) {
  return (Number(x || 0) * 100).toFixed(1) + "%";
}

function pts2(x) {
  return (Number(x || 0) * 100).toFixed(2) + " pts";
}

function signMoney0(x) {
  const n = Number(x || 0);
  const s = money0(Math.abs(n));
  return (n >= 0 ? "+" : "–") + s.replace("-", "");
}

function signInt(x) {
  const n = Math.round(Number(x || 0));
  const s = Math.abs(n).toLocaleString();
  return (n >= 0 ? "+" : "–") + s.replace("-", "");
}

function buildNarrative({ base, cur }) {
  const dSales = (cur.sales || 0) - (base.sales || 0);
  const dTx = (cur.transactions || 0) - (base.transactions || 0);
  const dLp = (cur.laborPct || 0) - (base.laborPct || 0);
  const laborDollarImpact = dLp * (cur.sales || 0);

  const salesPct = (base.sales > 0) ? (dSales / base.sales) : 0;
  const txPct = (base.transactions > 0) ? (dTx / base.transactions) : 0;

  const SALES_DOWN = salesPct <= -0.015;
  const SALES_UP = salesPct >= 0.015;
  const TX_DOWN = txPct <= -0.015;
  const TX_UP = txPct >= 0.015;
  const LABOR_UP = dLp >= 0.003;
  const LABOR_DOWN = dLp <= -0.003;

  const candidates = [
    { key: "sales", score: Math.abs(salesPct) * 1.0, flag: (SALES_DOWN || SALES_UP) },
    { key: "tx", score: Math.abs(txPct) * 0.95, flag: (TX_DOWN || TX_UP) },
    { key: "labor", score: Math.abs(dLp) * 1.25, flag: (LABOR_UP || LABOR_DOWN) }
  ].filter(x => x.flag);

  candidates.sort((a, b) => b.score - a.score);
  const primary = candidates[0]?.key || "mixed";

  let headline = "Execution Stabilization";
  let interpretation =
    "Stay composed. Avoid broad corrections. Reinforce strengths while isolating weak execution windows.";

  if (SALES_UP && (TX_UP || !TX_DOWN) && (LABOR_DOWN || !LABOR_UP)) {
    headline = "Controlled Improvement";
    interpretation =
      "This week shows controlled directional improvement. Protect the behaviors creating stability and avoid over-correcting.";
  } else if ((SALES_DOWN || TX_DOWN) && LABOR_UP) {
    headline = "Under Pressure";
    interpretation =
      "This week shows a pressure pattern: demand softened while labor guardrails drifted. Corrections must be isolated and enforced daily.";
  } else if (SALES_DOWN || TX_DOWN) {
    headline = "Recovery in Progress";
    interpretation =
      "Demand softened versus baseline weekly equivalent. Focus on throughput, conversion discipline, and shift consistency before changing strategy.";
  } else if (LABOR_UP) {
    headline = "Guardrail Drift";
    interpretation =
      "Labor guardrails drifted upward. Tighten deployment and station discipline while protecting guest-facing speed.";
  }

  const priorities = [];
  if (primary === "sales") {
    priorities.push("Protect peak-hour throughput (speed with accuracy — no re-makes).");
    priorities.push("Rebuild conversion discipline (line flow, expo control, and order accuracy).");
    priorities.push("Eliminate slow-bleed hours — assign ownership to the weakest daypart.");
  } else if (primary === "tx") {
    priorities.push("Restore transaction consistency (greeting speed, line engagement, and order completion).");
    priorities.push("Reduce abandonment in peak windows (position lock + fast handoff).");
    priorities.push("Coach the register / expo handoff — it’s where ticket loss hides.");
  } else if (primary === "labor") {
    priorities.push("Re-tighten labor deployment (right roles on the floor, no floating).");
    priorities.push("Stagger breaks to protect peaks; prevent uncovered stations.");
    priorities.push("Hold staffing to transaction flow (not schedule habit).");
  } else {
    priorities.push("Isolate the weakest shift window and coach repeatable behaviors.");
    priorities.push("Protect labor guardrails during peak hours.");
    priorities.push("Reinforce position lock and clean handoffs between shifts.");
  }

  const discipline = [
    "Hold a daily 5-minute huddle focused on the most vulnerable shift window.",
    "Assign 1 accountable owner per priority.",
    "Review progress midweek before changing strategy.",
    "Avoid broad changes — isolate corrections and confirm impact."
  ];

  let driverNote = "";
  if (primary === "sales") driverNote = `Primary driver: sales variance (${pct1(salesPct)}) vs baseline weekly equivalent.`;
  else if (primary === "tx") driverNote = `Primary driver: transaction variance (${pct1(txPct)}) vs baseline weekly equivalent.`;
  else if (primary === "labor") driverNote = `Primary driver: labor guardrail movement (${dLp >= 0 ? "+" : ""}${pts2(dLp)}) vs baseline weekly equivalent.`;
  else driverNote = "Primary driver: mixed movement — isolate the weakest window first.";

  const metrics = {
    salesLine: `Sales movement vs baseline week: ${signMoney0(dSales)} (${pct1(salesPct)})`,
    txLine: `Transaction movement vs baseline week: ${signInt(dTx)} (${pct1(txPct)})`,
    laborLine: `Labor guardrail movement vs baseline week: ${dLp >= 0 ? "+" : ""}${pts2(dLp)} (${signMoney0(laborDollarImpact)})`
  };

  return {
    headline,
    interpretation,
    priorities,
    discipline,
    driverNote,
    metrics
  };
}

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <h2>${title}</h2>
      <div class="meta">${line1}</div>
      ${line2 ? `<div class="meta" style="margin-top:8px;">${line2}</div>` : ""}
    </div>
  `);
}

function renderLiveActionPlan(truth) {
  const baselineLabel =
    truth.baselineStatus?.activeBaseline?.label ||
    truth.baselineStatus?.activeBaseline?.year ||
    "Approved baseline";

  const weekLabel = truth.latestWeek?.weekStart || "Approved week";

  const narrative = buildNarrative({
    base: truth.baselineWeeklyKpis,
    cur: truth.latestWeekKpis
  });

  const primaryAction = narrative.priorities[0] || "Protect execution discipline in the most vulnerable window.";
  const secondaryAction = narrative.priorities[1] || "Support the correction with tighter ownership and cadence.";

  setHtml(ROOT_ID, `
    <div class="card" style="margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start;">
        <div>
          <div class="small">Primary correction this week</div>
          <h2 style="margin:4px 0 8px 0;">${narrative.headline}</h2>
          <div class="meta">Scope: <b>${prettyLabel(truth.storeId)}</b></div>
          <div class="meta" style="margin-top:6px;">Reference: <b>${baselineLabel}</b> → <b>${weekLabel}</b></div>
        </div>
        <div class="cap-badge">Execution Plan</div>
      </div>

      <div class="cap-grid-3" style="margin-top:14px;">
        <div class="cap-metric">
          <div class="small">Sales</div>
          <div class="cap-metric-value">${narrative.metrics.salesLine}</div>
        </div>
        <div class="cap-metric">
          <div class="small">Transactions</div>
          <div class="cap-metric-value">${narrative.metrics.txLine}</div>
        </div>
        <div class="cap-metric">
          <div class="small">Labor Guardrail</div>
          <div class="cap-metric-value">${narrative.metrics.laborLine}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div style="font-weight:800;margin-bottom:6px;color:#0f172a;">Why this needs attention</div>
      <div class="meta" style="margin-bottom:10px;">${narrative.driverNote}</div>
      <div class="meta">${narrative.interpretation}</div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px 0;">Top Corrections to Hold</h3>
      <div class="cap-grid-2" style="margin-top:12px;">
        <div class="cap-action-box">
          <div class="small">Primary correction</div>
          <div class="cap-action-text">${primaryAction}</div>
        </div>
        <div class="cap-action-box">
          <div class="small">Secondary correction</div>
          <div class="cap-action-text">${secondaryAction}</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px 0;">Operational Discipline This Week</h3>
      <div class="cap-bullet-list">
        ${narrative.discipline.map(x => `<div>• ${x}</div>`).join("")}
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px 0;">Supporting Context</h3>
      <div class="meta" style="margin-bottom:10px;">
        Additional correction ideas remain visible, but execution should begin with the primary and secondary holds above.
      </div>
      <div class="cap-bullet-list">
        ${narrative.priorities.map(x => `<div>• ${x}</div>`).join("")}
      </div>
    </div>
  `);
}

async function loadCommercialActionPlan() {
  const resolvedStore = resolveSelectedStore();
  if (resolvedStore) setStoredActiveStore(resolvedStore);

  try {
    const truth = await loadCommercialStoreTruth({
      storeId: resolvedStore
    });

    if (truth?.storeId) setStoredActiveStore(truth.storeId);

    if (truth.state === "missing_context") {
      renderLocked("Action Plan", "Missing org or store context.");
      return;
    }

    if (truth.state === "pending_baseline") {
      renderLocked(
        `Action Plan — ${prettyLabel(truth.storeId || resolvedStore)}`,
        "A pending baseline exists, but it is not approved yet.",
        "Approve the baseline before generating a live action plan."
      );
      return;
    }

    if (truth.state === "missing_baseline") {
      renderLocked(
        `Action Plan — ${prettyLabel(truth.storeId || resolvedStore)}`,
        "No approved baseline found for this store."
      );
      return;
    }

    if (truth.state === "baseline_only") {
      renderLocked(
        `Action Plan — ${prettyLabel(truth.storeId || resolvedStore)}`,
        "Approved baseline exists, but no approved weekly upload has been saved yet.",
        "Save an approved weekly upload to generate a live action plan."
      );
      return;
    }

    renderLiveActionPlan(truth);
  } catch (e) {
    console.error("[commercial-action-plan] load failed:", e);
    renderLocked("Action Plan", "Unable to load action plan right now.");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  setHeaderContext();
  setupViewSelector();
  setupLogout();
  await loadCommercialActionPlan();
});