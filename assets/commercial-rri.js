// /assets/commercial-rri.js (v1)
// Commercial RRI shell
// ✅ Matches commercial RM page structure
// ✅ Uses commercial-rollup-data.js for scoped rollup truth
// ✅ Uses region / district / store selectors
// ✅ Uses scoped URL handling
// ✅ RM+ visibility pattern
// ✅ Shell-first commercial readiness layer
// ✅ Financial context + volatility attribution placeholders
// 🚫 No KPI math changes

import { loadCommercialRollupTruth } from "./commercial-rollup-data.js";

const ROOT_ID = "commercialRriRoot";
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

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtMoney(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function fmtMoney2(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });
}

function fmtNumber(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPct(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sumNumber(values) {
  return (values || []).reduce((sum, v) => sum + (isFinite(v) ? Number(v) : 0), 0);
}

function average(values) {
  const cleaned = (values || []).filter((v) => isFinite(v));
  if (!cleaned.length) return 0;
  return sumNumber(cleaned) / cleaned.length;
}

function pctDelta(cur, base) {
  const c = Number(cur);
  const b = Number(base);
  if (!isFinite(c) || !isFinite(b) || b === 0) return NaN;
  return ((c - b) / b) * 100;
}

function statusClassFromTotal(total) {
  if (total >= 80) return "crri-status-ready";
  if (total >= 60) return "crri-status-moderate";
  if (total >= 40) return "crri-status-progress";
  return "crri-status-risk";
}

function statusTextFromTotal(total) {
  if (total >= 80) return "Ready to Scale";
  if (total >= 60) return "Moderately Ready";
  if (total >= 40) return "In Progress";
  return "Execution Risk";
}

function scopeMsg(text, isErr = false) {
  const el = $("scopeMsg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isErr ? "#b91c1c" : "#065f46";
}

function uniqueValues(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

/* =========================================================
   Scope state
========================================================= */

let ALL_STORES = [];

function currentScope() {
  const params = getParams();
  const session = readSession() || {};
  return {
    orgId: String(params.orgId || session.orgId || "").trim(),
    regionId: normalizeId($("regionSelector")?.value || params.regionId || ""),
    districtId: normalizeId($("districtSelector")?.value || params.districtId || ""),
    storeId: normalizeId($("storeSelector")?.value || params.storeId || "")
  };
}

function updateUrlFromScope(scope = currentScope()) {
  const next = new URL(window.location.href);

  if (scope.orgId) next.searchParams.set("org", scope.orgId);
  else next.searchParams.delete("org");

  if (scope.regionId) next.searchParams.set("region", scope.regionId);
  else next.searchParams.delete("region");

  if (scope.districtId) next.searchParams.set("district", scope.districtId);
  else next.searchParams.delete("district");

  if (scope.storeId) next.searchParams.set("store", scope.storeId);
  else next.searchParams.delete("store");

  window.history.replaceState({}, "", next.toString());
}

function buildScopedUrl(path, scope = currentScope()) {
  const next = new URL(path, window.location.href);
  if (scope.orgId) next.searchParams.set("org", scope.orgId);
  if (scope.regionId) next.searchParams.set("region", scope.regionId);
  if (scope.districtId) next.searchParams.set("district", scope.districtId);
  if (scope.storeId) next.searchParams.set("store", scope.storeId);
  return next.toString();
}

function fillRegionSelector(selected = "") {
  const regions = uniqueValues(
    ALL_STORES.map((s) => normalizeId(s.regionId)).filter(Boolean)
  ).sort((a, b) => a.localeCompare(b));

  const el = $("regionSelector");
  if (!el) return;

  el.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Select region";
  el.appendChild(blank);

  regions.forEach((regionId) => {
    const opt = document.createElement("option");
    opt.value = regionId;
    opt.textContent = prettyLabel(regionId);
    if (regionId === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

function fillDistrictSelector(regionId = "", selected = "") {
  const districts = uniqueValues(
    ALL_STORES
      .filter((s) => !regionId || normalizeId(s.regionId) === normalizeId(regionId))
      .map((s) => normalizeId(s.districtId))
      .filter(Boolean)
  ).sort((a, b) => a.localeCompare(b));

  const el = $("districtSelector");
  if (!el) return;

  el.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Select district";
  el.appendChild(blank);

  districts.forEach((districtId) => {
    const opt = document.createElement("option");
    opt.value = districtId;
    opt.textContent = prettyLabel(districtId);
    if (districtId === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

function fillStoreSelector(regionId = "", districtId = "", selected = "") {
  const stores = ALL_STORES
    .filter((s) => !regionId || normalizeId(s.regionId) === normalizeId(regionId))
    .filter((s) => !districtId || normalizeId(s.districtId) === normalizeId(districtId))
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

  const el = $("storeSelector");
  if (!el) return;

  el.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Select store";
  el.appendChild(blank);

  stores.forEach((store) => {
    const opt = document.createElement("option");
    opt.value = normalizeId(store.id);
    opt.textContent = prettyLabel(store.name || store.id);
    if (normalizeId(store.id) === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

async function setupScopeSelectors() {
  const session = readSession() || {};
  const params = getParams();
  const orgId = String(params.orgId || session.orgId || "").trim();

  if (!orgId) {
    scopeMsg("Missing org context.", true);
    return;
  }

  const truth = await loadCommercialRollupTruth();
  const allStores = Array.isArray(truth.storesInScope)
    ? truth.storesInScope.map((x) => x.storeMeta).filter(Boolean)
    : [];

  const assignedRegionIds = Array.isArray(session.assigned_region_ids)
    ? session.assigned_region_ids.map(normalizeId)
    : [];

  const role = String(session.role || "rm").toLowerCase();
  let allowed = [...allStores];

  if (role === "rm" && assignedRegionIds.length) {
    allowed = allowed.filter((s) => assignedRegionIds.includes(normalizeId(s.regionId)));
  }

  ALL_STORES = allowed;

  const defaultRegion =
    params.regionId ||
    assignedRegionIds[0] ||
    normalizeId(allowed[0]?.regionId || "");

  fillRegionSelector(defaultRegion);

  const defaultDistrict =
    params.districtId ||
    normalizeId(
      allowed.find((s) => normalizeId(s.regionId) === defaultRegion)?.districtId || ""
    );

  fillDistrictSelector(defaultRegion, defaultDistrict);

  const defaultStore =
    params.storeId ||
    normalizeId(
      allowed.find(
        (s) =>
          normalizeId(s.regionId) === defaultRegion &&
          normalizeId(s.districtId) === defaultDistrict
      )?.id || ""
    );

  fillStoreSelector(defaultRegion, defaultDistrict, defaultStore);

  if (!ALL_STORES.length) {
    scopeMsg("No active stores available in current leadership scope.", true);
    return;
  }

  updateUrlFromScope({
    orgId,
    regionId: String($("regionSelector")?.value || "").trim(),
    districtId: String($("districtSelector")?.value || "").trim(),
    storeId: String($("storeSelector")?.value || "").trim()
  });

  scopeMsg(`✅ Readiness scope loaded. ${ALL_STORES.length} active store(s) available.`);

  $("regionSelector")?.addEventListener("change", async () => {
    const regionId = String($("regionSelector")?.value || "").trim();
    const firstDistrict = normalizeId(
      ALL_STORES.find((s) => normalizeId(s.regionId) === regionId)?.districtId || ""
    );

    fillDistrictSelector(regionId, firstDistrict);

    const firstStore = normalizeId(
      ALL_STORES.find(
        (s) =>
          normalizeId(s.regionId) === regionId &&
          normalizeId(s.districtId) === firstDistrict
      )?.id || ""
    );

    fillStoreSelector(regionId, firstDistrict, firstStore);

    updateUrlFromScope({
      orgId,
      regionId,
      districtId: String($("districtSelector")?.value || "").trim(),
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setRRIHeaderContext();
    await loadRriShell();
  });

  $("districtSelector")?.addEventListener("change", async () => {
    const regionId = String($("regionSelector")?.value || "").trim();
    const districtId = String($("districtSelector")?.value || "").trim();

    const firstStore = normalizeId(
      ALL_STORES.find(
        (s) =>
          normalizeId(s.regionId) === regionId &&
          normalizeId(s.districtId) === districtId
      )?.id || ""
    );

    fillStoreSelector(regionId, districtId, firstStore);

    updateUrlFromScope({
      orgId,
      regionId,
      districtId,
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setRRIHeaderContext();
    await loadRriShell();
  });

  $("storeSelector")?.addEventListener("change", async () => {
    updateUrlFromScope({
      orgId,
      regionId: String($("regionSelector")?.value || "").trim(),
      districtId: String($("districtSelector")?.value || "").trim(),
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setRRIHeaderContext();
    await loadRriShell();
  });
}

/* =========================================================
   Header / nav
========================================================= */

function setRRIHeaderContext() {
  const s = readSession() || {};
  const scope = currentScope();

  const role = String(s.role || "rm").toUpperCase();
  const orgId = scope.orgId || "N/A";
  const selectedRegion = scope.regionId;
  const selectedDistrict = scope.districtId;
  const selectedStore = scope.storeId;

  setText("sessionInfo", `Signed in as: ${s.email || "Unknown user"}`);

  setText(
    "rriContext",
    `Org: ${orgId} | Role: ${role} | Readiness Scope: ${
      selectedRegion ? prettyLabel(selectedRegion) : "Assigned leadership access"
    }`
  );

  let active = selectedRegion
    ? `Selected Region: ${prettyLabel(selectedRegion)}`
    : "Selected Region: All assigned regions";

  if (selectedDistrict) active += ` | District: ${prettyLabel(selectedDistrict)}`;
  if (selectedStore) active += ` | Store: ${prettyLabel(selectedStore)}`;

  setText("activeScope", active);
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

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

    window.location.href = buildScopedUrl(path);
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

/* =========================================================
   RRI shell scoring
========================================================= */

function buildCommercialRriModel(truth) {
  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;
  const base = truth.baselineWeeklyKpis || {};
  const childRows = Array.isArray(truth.childRows) ? truth.childRows : [];
  const counts = truth.counts || {};

  const salesVsBasePct = pctDelta(current.sales, base.sales);
  const txVsBasePct = pctDelta(current.transactions, base.transactions);
  const laborVsBasePts =
    isFinite(current.laborPct) && isFinite(base.laborPct)
      ? current.laborPct - base.laborPct
      : NaN;

  const wowSales = prev ? safeNum(current.sales) - safeNum(prev.sales) : NaN;
  const wowTx = prev ? safeNum(current.transactions) - safeNum(prev.transactions) : NaN;
  const wowLaborPts =
    prev && isFinite(current.laborPct) && isFinite(prev.laborPct)
      ? current.laborPct - prev.laborPct
      : NaN;

  const baselineCoverageRatio =
    safeNum(counts.totalStores, 0) > 0
      ? safeNum(counts.storesWithBaseline, 0) / safeNum(counts.totalStores, 0)
      : 0;

  const liveCoverageRatio =
    safeNum(counts.totalStores, 0) > 0
      ? safeNum(counts.storesLive, 0) / safeNum(counts.totalStores, 0)
      : 0;

  let execution = 10;
  if (isFinite(salesVsBasePct)) execution += clamp(Math.round(6 - Math.abs(salesVsBasePct) / 3), 0, 6);
  if (isFinite(txVsBasePct)) execution += clamp(Math.round(4 - Math.abs(txVsBasePct) / 4), 0, 4);
  execution = clamp(execution, 0, 20);

  let action = 8;
  if (isFinite(wowSales) && wowSales > 0) action += 5;
  if (isFinite(wowTx) && wowTx > 0) action += 4;
  if (isFinite(wowLaborPts) && wowLaborPts <= 0) action += 3;
  if (isFinite(wowSales) && wowSales < 0) action -= 3;
  if (isFinite(wowTx) && wowTx < 0) action -= 2;
  if (isFinite(wowLaborPts) && wowLaborPts > 0.35) action -= 2;
  action = clamp(action, 0, 20);

  let inventory = 6;
  if (childRows.length) {
    const volatilityList = childRows.map((row) => {
      const k = row.latestWeekKpis || {};
      const b = row.baselineWeeklyKpis || {};
      const p = row.previousWeekKpis || null;

      const salesBase = pctDelta(k.sales, b.sales);
      const txBase = pctDelta(k.transactions, b.transactions);
      const laborPressure =
        p && isFinite(k.laborPct) && isFinite(p.laborPct)
          ? Math.max(0, k.laborPct - p.laborPct)
          : 0;

      const score =
        (isFinite(salesBase) && salesBase < 0 ? Math.abs(salesBase) : 0) * 1.0 +
        (isFinite(txBase) && txBase < 0 ? Math.abs(txBase) : 0) * 0.9 +
        laborPressure * 6;

      return score;
    });

    const avgVolatility = average(volatilityList);
    inventory += clamp(Math.round(12 - (avgVolatility / 2)), 0, 12);
    inventory += childRows.length >= 2 ? 2 : 0;
  }
  inventory = clamp(inventory, 0, 20);

  let data = 0;
  data += Math.round(baselineCoverageRatio * 10);
  data += Math.round(liveCoverageRatio * 10);
  data = clamp(data, 0, 20);

  let financial = 8;
  if (isFinite(salesVsBasePct)) financial += clamp(Math.round(6 - Math.abs(salesVsBasePct) / 3), 0, 6);
  if (isFinite(laborVsBasePts) && laborVsBasePts <= 0) financial += 4;
  if (isFinite(laborVsBasePts) && laborVsBasePts > 0.5) financial -= 4;
  if (isFinite(salesVsBasePct) && salesVsBasePct < -6) financial -= 4;
  financial = clamp(financial, 0, 20);

  const total = clamp(execution + action + inventory + data + financial, 0, 100);
  const status = statusTextFromTotal(total);

  const childScores = childRows.map((row) => {
    const k = row.latestWeekKpis || {};
    const b = row.baselineWeeklyKpis || {};
    const p = row.previousWeekKpis || null;

    const salesBase = pctDelta(k.sales, b.sales);
    const txBase = pctDelta(k.transactions, b.transactions);
    const wowSalesChild = p ? safeNum(k.sales) - safeNum(p.sales) : 0;
    const wowTxChild = p ? safeNum(k.transactions) - safeNum(p.transactions) : 0;
    const wowLaborChild =
      p && isFinite(k.laborPct) && isFinite(p.laborPct)
        ? k.laborPct - p.laborPct
        : 0;

    let pressureScore =
      (isFinite(salesBase) && salesBase < 0 ? Math.abs(salesBase) : 0) * 1.0 +
      (isFinite(txBase) && txBase < 0 ? Math.abs(txBase) : 0) * 0.9 +
      (wowSalesChild < 0 ? Math.abs(wowSalesChild) / 100 : 0) * 0.2 +
      (wowTxChild < 0 ? Math.abs(wowTxChild) : 0) * 0.02 +
      (wowLaborChild > 0 ? wowLaborChild : 0) * 5;

    pressureScore = safeNum(pressureScore, 0);

    let readiness = clamp(Math.round(100 - pressureScore), 0, 100);
    let statusText = statusTextFromTotal(readiness);

    let primaryPressure = "Mixed";
    if (isFinite(salesBase) && salesBase < -2) primaryPressure = "Revenue softness";
    else if (isFinite(txBase) && txBase < -2) primaryPressure = "Transaction pressure";
    else if (wowLaborChild > 0.35) primaryPressure = "Labor volatility";
    else if (readiness >= 80) primaryPressure = "Controlled";

    const volatilityImpact =
      wowLaborChild > 0
        ? safeNum(k.sales, 0) * (wowLaborChild / 100)
        : 0;

    let scaleSignal = "Monitor";
    if (readiness >= 80) scaleSignal = "Strong";
    else if (readiness >= 60) scaleSignal = "Building";
    else if (readiness < 40) scaleSignal = "Constrained";

    return {
      unit: row.label || row.key || "Unit",
      level: row.level || "scope",
      readiness,
      statusText,
      primaryPressure,
      volatilityImpact,
      scaleSignal,
      pressureScore
    };
  }).sort((a, b) => b.pressureScore - a.pressureScore);

  const primaryDriver = childScores[0] || null;
  const secondDriver = childScores[1] || null;

  const estimatedSavingsOpportunity =
    Math.max(0, safeNum(base.sales, 0) - safeNum(current.sales, 0)) +
    Math.max(0, safeNum(laborVsBasePts, 0) / 100 * safeNum(current.sales, 0));

  const estimatedVolatilityExposure =
    childScores.reduce((sum, row) => sum + safeNum(row.volatilityImpact, 0), 0);

  return {
    execution,
    action,
    inventory,
    data,
    financial,
    total,
    status,
    salesVsBasePct,
    txVsBasePct,
    laborVsBasePts,
    wowSales,
    wowTx,
    wowLaborPts,
    baselineCoverageRatio,
    liveCoverageRatio,
    primaryDriver,
    secondDriver,
    childScores,
    estimatedSavingsOpportunity,
    estimatedVolatilityExposure
  };
}

/* =========================================================
   Rendering
========================================================= */

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <section class="cvrri-stack">
      <div class="card">
        <h2 class="section-title">${title}</h2>
        <p class="section-sub">${line1}</p>
        ${line2 ? `<p class="section-sub">${line2}</p>` : ""}
      </div>
    </section>
  `);
}

function setStatusPill(total, status) {
  const el = $("rriStatusPill");
  if (!el) return;

  el.className = `crri-status-pill ${statusClassFromTotal(total)}`;
  el.textContent = status;
}

function renderShell(truth) {
  const scope = currentScope();
  const model = buildCommercialRriModel(truth);

  setText("rriTotalValue", `${model.total} / 100`);
  setText(
    "rriTotalSub",
    `Current readiness is being interpreted from ${prettyLabel(scope.regionId || truth.scopeRegionId || "selected scope")} with commercial leadership framing.`
  );

  setStatusPill(model.total, model.status);
  setText(
    "rriStatusSub",
    model.primaryDriver
      ? `${prettyLabel(model.primaryDriver.unit)} is the strongest current readiness driver in this scope.`
      : "No primary driver identified yet."
  );

  setText("rriExecutionValue", `${model.execution} / 20`);
  setText(
    "rriExecutionSub",
    isFinite(model.salesVsBasePct)
      ? `Sales vs base ${model.salesVsBasePct.toFixed(1)}%`
      : "Awaiting live weekly comparison"
  );

  setText("rriActionValue", `${model.action} / 20`);
  setText(
    "rriActionSub",
    isFinite(model.wowSales)
      ? `${model.wowSales >= 0 ? "+" : ""}${fmtMoney(model.wowSales)} vs prior week`
      : "Awaiting prior week context"
  );

  setText("rriInventoryValue", `${model.inventory} / 20`);
  setText(
    "rriInventorySub",
    model.primaryDriver
      ? `Pressure source: ${prettyLabel(model.primaryDriver.unit)}`
      : "Awaiting attribution"
  );

  setText("rriDataValue", `${model.data} / 20`);
  setText(
    "rriDataSub",
    `${Math.round(model.liveCoverageRatio * 100)}% live coverage`
  );

  setText("rriFinancialValue", `${model.financial} / 20`);
  setText(
    "rriFinancialSub",
    isFinite(model.laborVsBasePts)
      ? `Labor vs base ${model.laborVsBasePts >= 0 ? "+" : ""}${model.laborVsBasePts.toFixed(2)} pts`
      : "Awaiting baseline comparison"
  );

  setHtml("rriInterpretationList", `
    <div>• Overall readiness is <span class="crri-strong">${model.status}</span> at <span class="crri-strong">${model.total} / 100</span>.</div>
    <div>• Execution is being interpreted from sales, transaction, and labor movement versus approved baseline rollup truth.</div>
    <div>• This shell is positioned for regional leadership and above so scaling conversations stay anchored to operating stability.</div>
  `);

  setHtml("rriFinancialContextList", `
    <div>• Estimated savings opportunity: <span class="crri-strong">${fmtMoney(model.estimatedSavingsOpportunity)}</span></div>
    <div>• Estimated volatility exposure: <span class="crri-strong">${fmtMoney(model.estimatedVolatilityExposure)}</span></div>
    <div>• Financial stability is currently reading <span class="crri-strong">${model.financial} / 20</span> based on revenue and labor guardrail movement.</div>
  `);

  setHtml("rriVolatilityList", `
    <div>• Primary volatility driver: <span class="crri-strong">${model.primaryDriver ? prettyLabel(model.primaryDriver.unit) : "Not identified"}</span></div>
    <div>• Secondary driver: <span class="crri-strong">${model.secondDriver ? prettyLabel(model.secondDriver.unit) : "Not identified"}</span></div>
    <div>• Current interpretation: leadership should focus first where readiness drag is strongest before assuming scaling confidence is evenly distributed.</div>
  `);

  setHtml("rriGuardrailList", `
    <div>• RRI stays positioned for RM and above because readiness should support scale judgment, not frontline coaching.</div>
    <div>• Store-level performance still belongs inside execution-facing pages, while this layer interprets hierarchy-wide stability.</div>
    <div>• Inventory and volatility signals should be read through district, regional, and enterprise aggregation — not as isolated store snapshots.</div>
  `);

  const bodyRows = model.childScores.length
    ? model.childScores.map((row) => `
        <tr>
          <td><span class="crri-strong">${prettyLabel(row.unit)}</span></td>
          <td>${prettyLabel(row.level)}</td>
          <td>${row.readiness} / 100</td>
          <td>${row.statusText}</td>
          <td>${row.primaryPressure}</td>
          <td>${fmtMoney(row.volatilityImpact)}</td>
          <td>${row.scaleSignal}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="7">No child readiness rows available for current scope.</td></tr>`;

  setHtml("rriBreakdownBody", bodyRows);

  setText(
    "rriExecutiveNote",
    model.primaryDriver
      ? `Commercial RRI currently indicates ${model.status.toLowerCase()} readiness in ${prettyLabel(scope.regionId || truth.scopeRegionId || "this scope")}, with ${prettyLabel(model.primaryDriver.unit)} contributing the strongest current volatility drag. This is where leadership visibility becomes useful: not just what the score is, but where instability is originating and what that means for scale confidence.`
      : `Commercial RRI is meant to help leadership understand how stable the selected operating scope is before making scale decisions, where pressure is concentrated, and how volatility should be interpreted financially across hierarchy.`
  );
}

async function loadRriShell() {
  try {
    const scope = currentScope();

    if (!scope.orgId) {
      renderLocked("Retail Readiness Index", "Missing org context.");
      return;
    }

    const truth = await loadCommercialRollupTruth();

    if (truth.state === "missing_context") {
      renderLocked("Retail Readiness Index", "Missing org context.");
      return;
    }

    if (truth.state === "no_stores") {
      renderLocked(
        "Retail Readiness Index",
        truth.message || "No stores found in this scope."
      );
      return;
    }

    if (truth.state === "missing_baseline") {
      renderLocked(
        "Retail Readiness Index",
        "No approved baseline found in this scope.",
        "RRI needs approved baseline truth before leadership readiness can be interpreted."
      );
      return;
    }

    if (truth.state === "baseline_only") {
      renderLocked(
        "Retail Readiness Index",
        "Approved baselines found, but no approved weekly uploads exist yet in this scope.",
        "RRI will become materially useful once live weekly truth is available for comparison."
      );
      return;
    }

    renderShell(truth);
  } catch (e) {
    console.error("[commercial-rri] load failed:", e);
    renderLocked(
      "Retail Readiness Index",
      "Unable to load readiness shell right now."
    );
  }
}

/* =========================================================
   Init
========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  setupLogout();
  setupViewSelector();
  await setupScopeSelectors();
  setRRIHeaderContext();
  await loadRriShell();
});