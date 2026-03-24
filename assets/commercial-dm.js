// /assets/commercial-dm.js (v12)
// District Manager page logic
// ✅ Uses commercial-rollup-data.js for approved rollup truth
// ✅ Uses commercial-db.js for store readiness + pending approvals
// ✅ Aggregates district totals from store-level approved truth
// ✅ Shows District Insight
// ✅ Adds Estimated Labor Impact
// ✅ Adds store readiness status
// ✅ Adds pending approval queue on same page
// ✅ DM can approve / reject pending weeks
// ✅ Preserves scoped navigation
// ✅ Adds district + store switching
// ✅ DM can step into store view from selected store
// 🚫 No KPI math changes

import { loadCommercialRollupTruth } from "./commercial-rollup-data.js";
import {
  listStores,
  getStoreWeekStatus,
  approveStoreWeek,
  rejectStoreWeek
} from "./commercial-db.js";
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
    districtId: normalizeId(params.get("district")),
    regionId: normalizeId(params.get("region")),
    storeId: normalizeId(params.get("store"))
  };
}

function prettyLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
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
    <div class="kpi-card">
      <div class="kpi-label">${title}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-delta ${deltaCls || "pending"}">${deltaText || "—"}</div>
    </div>
  `;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function statusTone(status) {
  if (status === "APPROVED") return "good";
  if (status === "PENDING_APPROVAL") return "pending";
  return "bad";
}

function statusBadge(status) {
  const tone = statusTone(status);
  return `<span class="status-pill ${tone}">${status.replace(/_/g, " ")}</span>`;
}

function buildStoreMetaMap(storeStatuses) {
  const out = {};
  (storeStatuses || []).forEach((x) => {
    out[x.storeId] = x;
  });
  return out;
}

function msgInline(text, isErr = false) {
  const root = $("dmInlineMsg");
  if (!root) return;
  root.textContent = text || "";
  root.style.color = isErr ? "#b91c1c" : "#065f46";
}

function scopeMsg(text, isErr = false) {
  const root = $("scopeMsg");
  if (!root) return;
  root.textContent = text || "";
  root.style.color = isErr ? "#b91c1c" : "#065f46";
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
    districtId: normalizeId($("districtSelector")?.value || params.districtId || ""),
    storeId: normalizeId($("storeSelector")?.value || params.storeId || ""),
    regionId: normalizeId(params.regionId || "")
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

function fillDistrictSelector(selected = "") {
  const districts = uniqueValues(
    ALL_STORES.map((s) => normalizeId(s.districtId)).filter(Boolean)
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

function fillStoreSelector(districtId = "", selected = "") {
  const stores = ALL_STORES
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

  const allStores = await listStores(orgId);
  const activeStores = (allStores || []).filter((s) => s.active !== false);

  const assignedStoreIds = Array.isArray(session.assigned_store_ids) ? session.assigned_store_ids.map(normalizeId) : [];
  const assignedDistrictIds = Array.isArray(session.assigned_district_ids) ? session.assigned_district_ids.map(normalizeId) : [];
  const role = String(session.role || "dm").toLowerCase();

  let allowed = [...activeStores];

  if (role === "dm" && assignedStoreIds.length) {
    allowed = allowed.filter((s) => assignedStoreIds.includes(normalizeId(s.id)));
  } else if (role === "dm" && assignedDistrictIds.length) {
    allowed = allowed.filter((s) => assignedDistrictIds.includes(normalizeId(s.districtId)));
  }

  ALL_STORES = allowed;

  const defaultDistrict =
    params.districtId ||
    assignedDistrictIds[0] ||
    normalizeId(allowed[0]?.districtId || "");

  fillDistrictSelector(defaultDistrict);
  fillStoreSelector(defaultDistrict, params.storeId || normalizeId(allowed.find((s) => normalizeId(s.districtId) === defaultDistrict)?.id || ""));

  if (!ALL_STORES.length) {
    scopeMsg("No active stores available in current district scope.", true);
    return;
  }

  const selectedDistrict = String($("districtSelector")?.value || "").trim();
  const selectedStore = String($("storeSelector")?.value || "").trim();

  if (selectedDistrict || selectedStore) {
    updateUrlFromScope({
      orgId,
      regionId: params.regionId || "",
      districtId: selectedDistrict,
      storeId: selectedStore
    });
  }

  scopeMsg(`✅ Scope loaded. ${ALL_STORES.length} active store(s) available.`);

  $("districtSelector")?.addEventListener("change", async () => {
    const districtId = String($("districtSelector")?.value || "").trim();
    const firstStoreInDistrict = normalizeId(
      ALL_STORES.find((s) => normalizeId(s.districtId) === districtId)?.id || ""
    );

    fillStoreSelector(districtId, firstStoreInDistrict);

    updateUrlFromScope({
      orgId,
      regionId: params.regionId || "",
      districtId,
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setDMHeaderContext();
    await loadDistrictRollup();
  });

  $("storeSelector")?.addEventListener("change", async () => {
    updateUrlFromScope({
      orgId,
      regionId: params.regionId || "",
      districtId: String($("districtSelector")?.value || "").trim(),
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setDMHeaderContext();
    await loadDistrictRollup();
  });
}

/* =========================================================
   Header / nav
========================================================= */

function setDMHeaderContext() {
  const s = readSession() || {};
  const scope = currentScope();

  const role = String(s.role || "dm").toUpperCase();
  const orgId = scope.orgId || "N/A";
  const selectedDistrict = scope.districtId;
  const selectedStore = scope.storeId;
  const selectedRegion = scope.regionId;

  setText("sessionInfo", `Signed in as: ${s.email || "Unknown user"}`);

  setText(
    "dmContext",
    `Org: ${orgId} | Role: ${role} | District Scope: ${
      selectedDistrict ? prettyLabel(selectedDistrict) : "Assigned district access"
    }`
  );

  let active = selectedDistrict
    ? `Selected District: ${prettyLabel(selectedDistrict)}`
    : "Selected District: All assigned districts";

  if (selectedStore) active += ` | Store: ${prettyLabel(selectedStore)}`;
  if (selectedRegion) active += ` | Region: ${prettyLabel(selectedRegion)}`;

  setText("activeDistrict", active);
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

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
   District Insight
========================================================= */

function buildDistrictInsight(truth) {
  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;
  const base = truth.baselineWeeklyKpis || {};
  const rows = Array.isArray(truth.childRows) ? truth.childRows : [];

  const salesVsBase = pctDelta(current.sales, base.sales);
  const txVsBase = pctDelta(current.transactions, base.transactions);
  const laborVsBase =
    isFinite(current.laborPct) && isFinite(base.laborPct)
      ? current.laborPct - base.laborPct
      : NaN;

  const salesWoW = prev ? safeNum(current.sales) - safeNum(prev.sales) : NaN;
  const txWoW = prev ? safeNum(current.transactions) - safeNum(prev.transactions) : NaN;
  const laborWoW =
    prev && isFinite(prev.laborPct) && isFinite(current.laborPct)
      ? current.laborPct - prev.laborPct
      : NaN;

  let direction = "Stable";
  if ((isFinite(salesWoW) && salesWoW > 0) || (isFinite(txWoW) && txWoW > 0)) {
    direction = "Improving";
  }
  if ((isFinite(salesWoW) && salesWoW < 0) || (isFinite(txWoW) && txWoW < 0)) {
    direction = "Under Pressure";
  }
  if (isFinite(laborWoW) && laborWoW > 0.35 && direction !== "Improving") {
    direction = "Guardrail Drift";
  }

  let estimatedLaborImpact = NaN;
  if (isFinite(laborVsBase) && isFinite(current.sales)) {
    estimatedLaborImpact = -(laborVsBase / 100) * current.sales;
  }

  const liveRows = rows.filter((row) => !!row.latestWeekKpis);
  const scoredRows = liveRows.map((row) => {
    const k = row.latestWeekKpis || {};
    const b = row.baselineWeeklyKpis || {};
    const p = row.previousWeekKpis || null;

    const wowSales = p ? safeNum(k.sales) - safeNum(p.sales) : 0;
    const wowTx = p ? safeNum(k.transactions) - safeNum(p.transactions) : 0;
    const wowLabor =
      p && isFinite(p.laborPct) && isFinite(k.laborPct)
        ? k.laborPct - p.laborPct
        : 0;

    const salesBasePct = pctDelta(k.sales, b.sales);
    const txBasePct = pctDelta(k.transactions, b.transactions);

    const pressureScore =
      (isFinite(salesBasePct) && salesBasePct < 0 ? Math.abs(salesBasePct) : 0) * 1.0 +
      (isFinite(txBasePct) && txBasePct < 0 ? Math.abs(txBasePct) : 0) * 0.9 +
      (wowSales < 0 ? Math.abs(wowSales) / 100 : 0) * 0.2 +
      (wowTx < 0 ? Math.abs(wowTx) : 0) * 0.02 +
      (wowLabor > 0 ? wowLabor : 0) * 4.0;

    return {
      label: row.label,
      key: row.key,
      pressureScore
    };
  });

  scoredRows.sort((a, b) => b.pressureScore - a.pressureScore);
  const topStore = scoredRows[0] || null;

  const priorityStore = topStore
    ? prettyLabel(topStore.label)
    : "No single store currently stands out";

  const driver = topStore
    ? `${prettyLabel(topStore.label)} is currently the main store to watch in the district.`
    : "District performance is staying relatively stable across active stores.";

  return {
    direction,
    salesVsBase,
    txVsBase,
    laborVsBase,
    estimatedLaborImpact,
    priorityStore,
    driver
  };
}

/* =========================================================
   Governance helpers
========================================================= */

async function loadDistrictStoreStatuses(orgId, districtId) {
  if (!orgId || !districtId) return [];

  const stores = await listStores(orgId);
  const inScopeStores = (stores || []).filter((s) =>
    s.active !== false &&
    normalizeId(s.districtId) === normalizeId(districtId)
  );

  const results = await Promise.all(
    inScopeStores.map(async (store) => {
      const ws = await getStoreWeekStatus(orgId, store.id);

      let readiness = "ACTION_NEEDED";
      if (ws?.pendingWeek) readiness = "PENDING_APPROVAL";
      else if (ws?.latestApprovedWeek) readiness = "APPROVED";

      return {
        storeId: normalizeId(store.id),
        storeName: store.name || store.id,
        pendingWeek: ws?.pendingWeek || null,
        latestApprovedWeek: ws?.latestApprovedWeek || null,
        readiness
      };
    })
  );

  return results;
}

function governanceSummary(storeStatuses) {
  const approved = (storeStatuses || []).filter((s) => s.readiness === "APPROVED").length;
  const pending = (storeStatuses || []).filter((s) => s.readiness === "PENDING_APPROVAL").length;
  const actionNeeded = (storeStatuses || []).filter((s) => s.readiness === "ACTION_NEEDED").length;

  return { approved, pending, actionNeeded };
}

/* =========================================================
   Rendering
========================================================= */

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <section class="cdm-stack">
      <div class="card">
        <h2 class="section-title">${title}</h2>
        <p class="section-sub">${line1}</p>
        ${line2 ? `<p class="section-sub cdm-tight">${line2}</p>` : ""}
      </div>
    </section>
  `);
}

function renderLiveDistrict(truth, storeStatuses) {
  const scope = currentScope();
  const current = truth.latestWeekKpis || {};
  const prev = truth.previousWeekKpis || null;
  const base = truth.baselineWeeklyKpis || {};
  const insight = buildDistrictInsight(truth);
  const summary = governanceSummary(storeStatuses);
  const storeMeta = buildStoreMetaMap(storeStatuses);

  const salesDelta = prev ? current.sales - prev.sales : NaN;
  const txDelta = prev ? current.transactions - prev.transactions : NaN;
  const laborPctDelta =
    prev && isFinite(prev.laborPct) && isFinite(current.laborPct)
      ? current.laborPct - prev.laborPct
      : NaN;
  const avgTicketDelta =
    prev && isFinite(prev.avgTicket) && isFinite(current.avgTicket)
      ? current.avgTicket - prev.avgTicket
      : NaN;

  const salesCls = deltaClass(salesDelta, "up");
  const txCls = deltaClass(txDelta, "up");
  const laborCls = deltaClass(laborPctDelta, "down");
  const avgTicketCls = deltaClass(avgTicketDelta, "up");

  const latestWeekLabel = truth.latestWeekLabel || "Latest approved week";

  const pendingQueueRows = (storeStatuses || [])
    .filter((row) => row.pendingWeek)
    .map((row) => `
      <tr>
        <td><span class="cdm-text-strong">${prettyLabel(row.storeId)}</span></td>
        <td>${prettyLabel(row.storeName || row.storeId)}</td>
        <td>${row.pendingWeek?.weekStart || "—"}</td>
        <td>${row.pendingWeek?.rowCount || 0}</td>
        <td>${statusBadge("PENDING_APPROVAL")}</td>
        <td style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" type="button" data-approve-week="${row.pendingWeek?.id || row.pendingWeek?.weekId || ""}" data-store-id="${row.storeId}">
            Approve
          </button>
          <button class="btn secondary" type="button" data-reject-week="${row.pendingWeek?.id || row.pendingWeek?.weekId || ""}" data-store-id="${row.storeId}">
            Reject
          </button>
        </td>
      </tr>
    `)
    .join("");

  const rowsHtml = (truth.childRows || []).map((row) => {
    const k = row.latestWeekKpis || null;
    const b = row.baselineWeeklyKpis || {};
    const p = row.previousWeekKpis || null;

    const wowSales = p && k ? (k.sales - p.sales) : NaN;
    const wowTx = p && k ? (k.transactions - p.transactions) : NaN;
    const wowLabor =
      p && k && isFinite(p.laborPct) && isFinite(k.laborPct)
        ? (k.laborPct - p.laborPct)
        : NaN;

    const salesVsBase = k ? pctDelta(k.sales, b.sales) : NaN;
    const txVsBase = k ? pctDelta(k.transactions, b.transactions) : NaN;
    const hasLive = !!k;
    const meta = storeMeta[normalizeId(row.key)] || null;
    const readiness = meta?.readiness || (hasLive ? "APPROVED" : "ACTION_NEEDED");
    const rowStoreId = normalizeId(row.key);

    return `
      <tr>
        <td>
          <div class="cdm-text-strong">${prettyLabel(row.label)}</div>
          <div style="margin-top:6px;">
            <button class="btn secondary" type="button" data-open-store="${rowStoreId}">
              Open Store
            </button>
          </div>
        </td>
        <td>${statusBadge(readiness)}</td>
        <td>${hasLive ? fmtMoney(k.sales) : "—"}</td>
        <td>${hasLive ? fmtNumber(k.transactions) : "—"}</td>
        <td>${hasLive ? fmtPct(k.laborPct) : "—"}</td>
        <td>${hasLive ? fmtMoney2(k.avgTicket) : "—"}</td>
        <td class="${hasLive && p ? deltaClass(wowSales, "up") : "pending"}">${hasLive && p ? fmtDeltaMoney0(wowSales) : "—"}</td>
        <td class="${hasLive && p ? deltaClass(wowTx, "up") : "pending"}">${hasLive && p ? fmtDeltaNumber0(wowTx) : "—"}</td>
        <td class="${hasLive && p ? deltaClass(wowLabor, "down") : "pending"}">${hasLive && p ? fmtDeltaPct(wowLabor) : "—"}</td>
        <td class="${isFinite(salesVsBase) ? (salesVsBase >= 0 ? "good" : "bad") : "pending"}">
          ${isFinite(salesVsBase) ? salesVsBase.toFixed(1) + "%" : "—"}
        </td>
        <td class="${isFinite(txVsBase) ? (txVsBase >= 0 ? "good" : "bad") : "pending"}">
          ${isFinite(txVsBase) ? txVsBase.toFixed(1) + "%" : "—"}
        </td>
      </tr>
    `;
  }).join("");

  const selectedStoreBlock = scope.storeId
    ? `
      <div class="card">
        <h3 class="section-title cdm-subtitle">Selected Store</h3>
        <p class="section-sub">
          Current store scope:
          <span class="cdm-text-strong">${prettyLabel(scope.storeId)}</span>
        </p>
        <div style="margin-top:10px;">
          <button class="btn secondary" type="button" data-open-store="${scope.storeId}">
            Open Store Dashboard
          </button>
        </div>
      </div>
    `
    : "";

  setHtml(ROOT_ID, `
    <section class="cdm-stack">
      <div class="card">
        <h2 class="section-title">District Rollup — ${prettyLabel(truth.scopeDistrictId || scope.districtId || "Selected District")}</h2>
        <p class="section-sub">
          Latest approved district performance is aggregated across active stores in scope.
        </p>
        <p class="section-sub cdm-tight">
          Live Stores: <span class="cdm-text-strong">${fmtNumber(truth.counts?.storesLive || 0)}</span> |
          Baseline Stores: <span class="cdm-text-strong">${fmtNumber(truth.counts?.storesWithBaseline || 0)}</span> |
          Latest Week: <span class="cdm-text-strong">${latestWeekLabel}</span>
        </p>
      </div>

      ${selectedStoreBlock}

      <div class="kpi-grid cdm-kpi-grid">
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

      <div class="card">
        <h3 class="section-title cdm-subtitle">District Insight</h3>
        <div class="status-wrap cdm-status-wrap">
          <span class="status-pill">${insight.direction}</span>
        </div>

        <div class="meta-grid cdm-meta-grid">
          <div class="info-box">
            <h3>District Trend</h3>
            <p>
              Sales vs baseline: ${isFinite(insight.salesVsBase) ? `${insight.salesVsBase.toFixed(1)}%` : "—"} |
              Transactions vs baseline: ${isFinite(insight.txVsBase) ? `${insight.txVsBase.toFixed(1)}%` : "—"} |
              Labor vs baseline: ${isFinite(insight.laborVsBase) ? `${insight.laborVsBase >= 0 ? "+" : ""}${insight.laborVsBase.toFixed(2)} pts` : "—"}
            </p>
          </div>
          <div class="info-box">
            <h3>Priority Store</h3>
            <p>${insight.priorityStore}</p>
          </div>
        </div>

        <hr class="hr" />

        <h3 class="section-title cdm-subtitle">Financial Impact</h3>
        <p class="section-sub">${insight.driver}</p>
        <p class="section-sub cdm-tight">
          Estimated Labor Impact:
          <span class="${insight.estimatedLaborImpact > 0 ? "good" : insight.estimatedLaborImpact < 0 ? "bad" : "pending"} cdm-text-strong">
            ${isFinite(insight.estimatedLaborImpact) ? fmtMoney(insight.estimatedLaborImpact) : "—"}
          </span>
        </p>
      </div>

      <div class="card">
        <h3 class="section-title cdm-subtitle">District Readiness</h3>
        <div class="meta-grid cdm-meta-grid">
          <div class="info-box">
            <h3>Approved</h3>
            <p>${fmtNumber(summary.approved)} stores</p>
          </div>
          <div class="info-box">
            <h3>Pending Approval</h3>
            <p>${fmtNumber(summary.pending)} stores</p>
          </div>
        </div>
        <div class="info-box" style="margin-top:12px;">
          <h3>Action Needed</h3>
          <p>${fmtNumber(summary.actionNeeded)} stores</p>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <h3 class="section-title cdm-subtitle">Pending Approval Queue</h3>
            <p class="section-sub">Approve or reject store weekly submissions before they enter district approved truth.</p>
          </div>
          <div id="dmInlineMsg" class="meta"></div>
        </div>

        <div class="table-wrap cdm-table-wrap">
          <table class="table cdm-table">
            <thead>
              <tr>
                <th>Store ID</th>
                <th>Store</th>
                <th>Week</th>
                <th>Rows</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${pendingQueueRows || `<tr><td colspan="6">No pending weekly uploads in this district.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title cdm-subtitle">District Baseline Reference</h3>
        <div class="cdm-bullet-stack">
          <div>• Baseline Weekly Sales: ${fmtMoney(base.sales)}</div>
          <div>• Baseline Weekly Transactions: ${fmtNumber(base.transactions)}</div>
          <div>• Baseline Labor %: ${fmtPct(base.laborPct)}</div>
          <div>• Baseline Avg Ticket: ${fmtMoney2(base.avgTicket)}</div>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title cdm-subtitle">Store Breakdown</h3>
        <p class="section-sub">
          Each row below is one store inside this district. Approved truth remains separate from pending approval status.
        </p>

        <div class="table-wrap cdm-table-wrap">
          <table class="table cdm-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Status</th>
                <th>Sales</th>
                <th>Transactions</th>
                <th>Labor %</th>
                <th>Avg Ticket</th>
                <th>WoW Sales</th>
                <th>WoW Tx</th>
                <th>WoW Labor</th>
                <th>Sales vs Base</th>
                <th>Tx vs Base</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || `<tr><td colspan="11">No store rows found.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>
  `);
}

/* =========================================================
   Actions
========================================================= */

async function handleApproveWeek(storeId, weekId) {
  try {
    const session = readSession() || {};
    const scope = currentScope();

    msgInline("Approving week…");

    await approveStoreWeek({
      orgId: scope.orgId,
      storeId,
      weekId,
      approvedByUid: session.uid || null,
      approvedByEmail: session.email || null
    });

    msgInline(`✅ Approved ${weekId}`);
    await loadDistrictRollup();
  } catch (e) {
    msgInline(`❌ ${e?.message || "Failed to approve week"}`, true);
  }
}

async function handleRejectWeek(storeId, weekId) {
  try {
    const session = readSession() || {};
    const scope = currentScope();

    msgInline("Rejecting week…");

    await rejectStoreWeek({
      orgId: scope.orgId,
      storeId,
      weekId,
      rejectedByUid: session.uid || null,
      rejectedByEmail: session.email || null,
      reason: "District review rejected upload"
    });

    msgInline(`⚠️ Rejected ${weekId}`);
    await loadDistrictRollup();
  } catch (e) {
    msgInline(`❌ ${e?.message || "Failed to reject week"}`, true);
  }
}

function openStoreView(storeId) {
  const scope = currentScope();
  const next = new URL("./commercial-portal.html", window.location.href);
  if (scope.orgId) next.searchParams.set("org", scope.orgId);
  if (scope.regionId) next.searchParams.set("region", scope.regionId);
  if (scope.districtId) next.searchParams.set("district", scope.districtId);
  if (storeId) next.searchParams.set("store", normalizeId(storeId));
  window.location.href = next.toString();
}

function setupGovernanceActions() {
  const root = $(ROOT_ID);
  if (!root) return;

  root.addEventListener("click", async (e) => {
    const approveBtn = e.target.closest("[data-approve-week]");
    if (approveBtn) {
      const weekId = String(approveBtn.getAttribute("data-approve-week") || "").trim();
      const storeId = normalizeId(approveBtn.getAttribute("data-store-id"));
      if (!weekId || !storeId) return;
      await handleApproveWeek(storeId, weekId);
      return;
    }

    const rejectBtn = e.target.closest("[data-reject-week]");
    if (rejectBtn) {
      const weekId = String(rejectBtn.getAttribute("data-reject-week") || "").trim();
      const storeId = normalizeId(rejectBtn.getAttribute("data-store-id"));
      if (!weekId || !storeId) return;
      await handleRejectWeek(storeId, weekId);
      return;
    }

    const openStoreBtn = e.target.closest("[data-open-store]");
    if (openStoreBtn) {
      const storeId = normalizeId(openStoreBtn.getAttribute("data-open-store"));
      if (!storeId) return;
      openStoreView(storeId);
    }
  });
}

/* =========================================================
   Load
========================================================= */

async function loadDistrictRollup() {
  try {
    const scope = currentScope();

    if (!scope.orgId) {
      renderLocked("District Rollup", "Missing org context.");
      return;
    }

    if (!scope.districtId) {
      renderLocked("District Rollup", "Select a district to load district rollup.");
      return;
    }

    const truth = await loadCommercialRollupTruth();
    const storeStatuses = await loadDistrictStoreStatuses(scope.orgId, scope.districtId);

    if (truth.state === "missing_context") {
      renderLocked("District Rollup", "Missing org context.");
      return;
    }

    if (truth.state === "no_stores") {
      renderLocked(
        "District Rollup",
        truth.message || "No stores found in this district scope."
      );
      return;
    }

    if (truth.state === "missing_baseline") {
      renderLocked(
        `District Rollup — ${prettyLabel(scope.districtId || truth.scopeDistrictId || "Selected District")}`,
        "No approved baseline found in this district scope."
      );
      return;
    }

    if (truth.state === "baseline_only") {
      renderLocked(
        `District Rollup — ${prettyLabel(scope.districtId || truth.scopeDistrictId || "Selected District")}`,
        "Approved baselines found, but no approved weekly uploads exist yet in this district scope."
      );
      return;
    }

    renderLiveDistrict(truth, storeStatuses);
  } catch (e) {
    console.error("[commercial-dm] load failed:", e);
    renderLocked("District Rollup", "Unable to load district rollup right now.");
  }
}

/* =========================================================
   Init
========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  setupLogout();
  setupViewSelector();
  setupGovernanceActions();
  await setupScopeSelectors();
  setDMHeaderContext();
  await loadDistrictRollup();
});