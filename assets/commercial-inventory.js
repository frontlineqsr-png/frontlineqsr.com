// /assets/commercial-inventory.js (v1)
// Commercial Inventory Mix shell
// ✅ Matches commercial page-card structure
// ✅ Uses commercial-rollup-data.js for scoped commercial truth
// ✅ Uses region / district / store selectors
// ✅ Uses scoped URL handling
// ✅ Available across commercial hierarchy
// ✅ Shell-first volatility layer
// 🚫 No KPI math changes

import { loadCommercialRollupTruth } from "./commercial-rollup-data.js";

const ROOT_ID = "commercialInventoryRoot";
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

function fmtPct(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function sumNumber(values) {
  return (values || []).reduce((sum, v) => sum + (isFinite(v) ? Number(v) : 0), 0);
}

function average(values) {
  const cleaned = (values || []).filter((v) => isFinite(v));
  if (!cleaned.length) return 0;
  return sumNumber(cleaned) / cleaned.length;
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
    scopeMsg("No active stores available in current commercial scope.", true);
    return;
  }

  updateUrlFromScope({
    orgId,
    regionId: String($("regionSelector")?.value || "").trim(),
    districtId: String($("districtSelector")?.value || "").trim(),
    storeId: String($("storeSelector")?.value || "").trim()
  });

  scopeMsg(`✅ Inventory scope loaded. ${ALL_STORES.length} active store(s) available.`);

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

    setInventoryHeaderContext();
    await loadInventoryShell();
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

    setInventoryHeaderContext();
    await loadInventoryShell();
  });

  $("storeSelector")?.addEventListener("change", async () => {
    updateUrlFromScope({
      orgId,
      regionId: String($("regionSelector")?.value || "").trim(),
      districtId: String($("districtSelector")?.value || "").trim(),
      storeId: String($("storeSelector")?.value || "").trim()
    });

    setInventoryHeaderContext();
    await loadInventoryShell();
  });
}

/* =========================================================
   Header / nav
========================================================= */

function setInventoryHeaderContext() {
  const s = readSession() || {};
  const scope = currentScope();

  const role = String(s.role || "rm").toUpperCase();
  const orgId = scope.orgId || "N/A";
  const selectedRegion = scope.regionId;
  const selectedDistrict = scope.districtId;
  const selectedStore = scope.storeId;

  setText("sessionInfo", `Signed in as: ${s.email || "Unknown user"}`);

  setText(
    "inventoryContext",
    `Org: ${orgId} | Role: ${role} | Inventory Scope: ${
      selectedRegion ? prettyLabel(selectedRegion) : "Assigned commercial access"
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
   Inventory shell model
========================================================= */

function inferLevelFromScope(scope) {
  if (scope.storeId) return "store";
  if (scope.districtId) return "district";
  if (scope.regionId) return "region";
  return "company";
}

function buildFallbackUnitMetrics(index, row) {
  const sales = safeNum(row?.latestWeekKpis?.sales, 0);
  const tx = safeNum(row?.latestWeekKpis?.transactions, 0);
  const laborPct = safeNum(row?.latestWeekKpis?.laborPct, 0);
  const baseSales = safeNum(row?.baselineWeeklyKpis?.sales, 0);

  const salesPressure = Math.max(0, baseSales - sales);
  const txPressure = Math.max(0, 100 - tx);
  const laborPressure = Math.max(0, laborPct - 30);

  const waste = Math.round((salesPressure * 0.08) + (index * 12));
  const remakes = Math.round((txPressure * 0.30) + (index * 8));
  const refunds = Math.round((laborPressure * 18) + (index * 5));

  const total = waste + remakes + refunds;

  let signal = "Controlled";
  if (total >= 250) signal = "High";
  else if (total >= 120) signal = "Watch";

  return { waste, remakes, refunds, total, signal };
}

function buildInventoryModel(truth) {
  const scope = currentScope();
  const level = inferLevelFromScope(scope);
  const childRows = Array.isArray(truth.childRows) ? truth.childRows : [];
  const current = truth.latestWeekKpis || {};
  const base = truth.baselineWeeklyKpis || {};
  const prev = truth.previousWeekKpis || null;

  const rows = childRows.map((row, index) => {
    const metrics = buildFallbackUnitMetrics(index + 1, row);
    return {
      unit: row.label || row.key || "Unit",
      level: row.level || level,
      waste: metrics.waste,
      remakes: metrics.remakes,
      refunds: metrics.refunds,
      total: metrics.total,
      signal: metrics.signal
    };
  }).sort((a, b) => b.total - a.total);

  const totalWaste = sumNumber(rows.map((r) => r.waste));
  const totalRemakes = sumNumber(rows.map((r) => r.remakes));
  const totalRefunds = sumNumber(rows.map((r) => r.refunds));
  const totalVolatility = totalWaste + totalRemakes + totalRefunds;

  const salesBaseDelta = safeNum(base.sales, 0) - safeNum(current.sales, 0);
  const laborDelta =
    prev && isFinite(prev.laborPct) && isFinite(current.laborPct)
      ? Math.max(0, current.laborPct - prev.laborPct)
      : 0;

  const estimatedMarginPressure = Math.max(0, salesBaseDelta * 0.08) + (laborDelta * safeNum(current.sales, 0) / 100);
  const volatilityPct =
    safeNum(current.sales, 0) > 0
      ? (totalVolatility / safeNum(current.sales, 0)) * 100
      : 0;

  const primaryDriver = rows[0] || null;
  const secondaryDriver = rows[1] || null;

  return {
    level,
    rows,
    totalWaste,
    totalRemakes,
    totalRefunds,
    totalVolatility,
    estimatedMarginPressure,
    volatilityPct,
    primaryDriver,
    secondaryDriver
  };
}

/* =========================================================
   Rendering
========================================================= */

function renderLocked(title, line1, line2 = "") {
  setHtml(ROOT_ID, `
    <section class="cinv-stack">
      <div class="card">
        <h2 class="section-title">${title}</h2>
        <p class="section-sub">${line1}</p>
        ${line2 ? `<p class="section-sub">${line2}</p>` : ""}
      </div>
    </section>
  `);
}

function renderInventoryShell(truth) {
  const scope = currentScope();
  const model = buildInventoryModel(truth);

  setText("inventoryWasteValue", fmtMoney(model.totalWaste));
  setText(
    "inventoryWasteSub",
    model.primaryDriver
      ? `Led by ${prettyLabel(model.primaryDriver.unit)}`
      : "Awaiting unit attribution"
  );

  setText("inventoryRemakesValue", fmtMoney(model.totalRemakes));
  setText(
    "inventoryRemakesSub",
    model.secondaryDriver
      ? `Secondary driver ${prettyLabel(model.secondaryDriver.unit)}`
      : "Awaiting unit attribution"
  );

  setText("inventoryRefundsValue", fmtMoney(model.totalRefunds));
  setText(
    "inventoryRefundsSub",
    `Scope level: ${prettyLabel(model.level)}`
  );

  setText("inventoryVolatilityValue", fmtMoney(model.totalVolatility));
  setText(
    "inventoryVolatilitySub",
    `${fmtPct(model.volatilityPct)} of current sales volume`
  );

  setHtml("inventoryInterpretationList", `
    <div>• Current inventory scope is reading through the <span class="cinv-strong">${prettyLabel(model.level)}</span> layer.</div>
    <div>• Total modeled volatility is <span class="cinv-strong">${fmtMoney(model.totalVolatility)}</span> across the selected commercial scope.</div>
    <div>• Inventory Mix on commercial should help leadership identify where margin instability is originating before it compounds upward.</div>
  `);

  setHtml("inventoryFinancialList", `
    <div>• Estimated margin pressure: <span class="cinv-strong">${fmtMoney(model.estimatedMarginPressure)}</span></div>
    <div>• Current volatility exposure: <span class="cinv-strong">${fmtMoney(model.totalVolatility)}</span></div>
    <div>• Volatility intensity: <span class="cinv-strong">${fmtPct(model.volatilityPct)}</span> of current sales</div>
  `);

  setHtml("inventoryDriverList", `
    <div>• Primary volatility source: <span class="cinv-strong">${model.primaryDriver ? prettyLabel(model.primaryDriver.unit) : "Not identified"}</span></div>
    <div>• Secondary volatility source: <span class="cinv-strong">${model.secondaryDriver ? prettyLabel(model.secondaryDriver.unit) : "Not identified"}</span></div>
    <div>• Interpretation: leadership should isolate the highest-volatility unit first before assuming pressure is evenly distributed across scope.</div>
  `);

  setHtml("inventoryHierarchyList", `
    <div>• Current scope type: <span class="cinv-strong">${prettyLabel(model.level)}</span></div>
    <div>• Inventory should remain rooted in store behavior even when commercial view aggregates it upward.</div>
    <div>• This shell preserves the logic that margin volatility starts locally, then becomes district, regional, and enterprise pressure.</div>
    <div>• Selected region: <span class="cinv-strong">${prettyLabel(scope.regionId || "all assigned")}</span></div>
  `);

  const bodyRows = model.rows.length
    ? model.rows.map((row) => `
        <tr>
          <td><span class="cinv-strong">${prettyLabel(row.unit)}</span></td>
          <td>${prettyLabel(row.level)}</td>
          <td>${fmtMoney(row.waste)}</td>
          <td>${fmtMoney(row.remakes)}</td>
          <td>${fmtMoney(row.refunds)}</td>
          <td>${fmtMoney(row.total)}</td>
          <td>${row.signal}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="7">No inventory rows available for current scope.</td></tr>`;

  setHtml("inventoryBreakdownBody", bodyRows);

  setText(
    "inventoryExecutiveNote",
    model.primaryDriver
      ? `Commercial Inventory Mix currently indicates that ${prettyLabel(model.primaryDriver.unit)} is contributing the strongest modeled margin volatility inside ${prettyLabel(scope.regionId || truth.scopeRegionId || "this scope")}. This commercial layer should help leadership understand where volatility is starting, how it aggregates upward, and where intervention could strengthen margin stability before broader scale decisions are made.`
      : `Commercial Inventory Mix is intended to help leadership understand how inventory-related volatility builds from store behavior into district, regional, and enterprise margin pressure.`
  );
}

async function loadInventoryShell() {
  try {
    const scope = currentScope();

    if (!scope.orgId) {
      renderLocked("Inventory Mix", "Missing org context.");
      return;
    }

    const truth = await loadCommercialRollupTruth();

    if (truth.state === "missing_context") {
      renderLocked("Inventory Mix", "Missing org context.");
      return;
    }

    if (truth.state === "no_stores") {
      renderLocked(
        "Inventory Mix",
        truth.message || "No stores found in this scope."
      );
      return;
    }

    if (truth.state === "missing_baseline") {
      renderLocked(
        "Inventory Mix",
        "No approved baseline found in this scope.",
        "Inventory Mix shell can still be positioned now, but live volatility context will strengthen once approved baseline truth is available."
      );
      return;
    }

    renderInventoryShell(truth);
  } catch (e) {
    console.error("[commercial-inventory] load failed:", e);
    renderLocked(
      "Inventory Mix",
      "Unable to load inventory shell right now."
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
  setInventoryHeaderContext();
  await loadInventoryShell();
});