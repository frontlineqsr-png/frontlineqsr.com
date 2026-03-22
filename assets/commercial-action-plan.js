// /assets/commercial-action-plan.js (v6)
// Commercial Action Plan — shared premium commercial design
// ✅ Uses commercial-kpi-data.js shared adapter
// ✅ Resolves active store from URL, session, localStorage, or assigned stores
// ✅ Uses approved baseline + latest approved week
// ✅ Includes labor points + labor dollar impact
// ✅ Uses shared styles.css card/panel system
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
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
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

function metricCard(label, value) {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="cap-metric-value">${value}</div>
    </div>
  `;
}

function infoBox(title, body) {
  return `
    <div class="info-box">
      <h3>${title}</h3>
      <p>${body}</p>
    </div>
  `;
}

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <section class="cap-stack">
      <div class="card">
        <h2 class="section-title">${title}</h2>
        <p class="section-sub">${line1}</p>
        ${line2 ? `<p class="section-sub cap-tight">${line2}</p>` : ""}
      </div>
    </section>
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
    <section class="cap-stack">
      <div class="card">
        <div class="cap-card-head">
          <div>
            <div class="small">Primary correction this week</div>
            <h2 class="section-title cap-primary-title">${narrative.headline}</h2>
            <p class="section-sub cap-tight">Scope: <span class="cap-text-strong">${prettyLabel(truth.storeId)}</span></p>
            <p class="section-sub cap-tight">Reference: <span class="cap-text-strong">${baselineLabel}</span> → <span class="cap-text-strong">${weekLabel}</span></p>
          </div>
          <div>
            <span class="status-pill cap-pill">Execution Plan</span>
          </div>
        </div>

        <div class="kpi-grid cap-kpi-grid">
          ${metricCard("Sales", narrative.metrics.salesLine)}
          ${metricCard("Transactions", narrative.metrics.txLine)}
          ${metricCard("Labor Guardrail", narrative.metrics.laborLine)}
        </div>

        <hr class="hr" />

        <h3 class="section-title cap-subtitle">Why this needs attention</h3>
        <p class="section-sub">${narrative.driverNote}</p>
        <p class="section-sub cap-tight">${narrative.interpretation}</p>
      </div>

      <div class="meta-grid">
        ${infoBox("Primary correction", primaryAction)}
        ${infoBox("Secondary correction", secondaryAction)}
      </div>

      <div class="card">
        <h3 class="section-title cap-subtitle">Operational Discipline This Week</h3>
        <div class="cap-bullet-stack">
          ${narrative.discipline.map(x => `<div>• ${x}</div>`).join("")}
        </div>
      </div>

      <div class="card">
        <h3 class="section-title cap-subtitle">Supporting Context</h3>
        <p class="section-sub">
          Additional correction ideas remain visible, but execution should begin with the primary and secondary holds above.
        </p>
        <div class="cap-bullet-stack">
          ${narrative.priorities.map(x => `<div>• ${x}</div>`).join("")}
        </div>
      </div>
    </section>
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
  setHeaderContext();
  setupViewSelector();
  setupLogout();
  await loadCommercialActionPlan();
});