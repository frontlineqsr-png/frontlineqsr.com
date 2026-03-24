// /assets/commercial-weekly-upload.js (v2)
// Commercial weekly upload page
// ✅ Store uploads DAILY rows for one required week
// ✅ DM and above can switch scope and upload on behalf of selected store
// ✅ Region / District / Store selectors added
// ✅ District upload coverage panel added
// ✅ Uses commercial-db.js weekly save flow
// ✅ Uses pending approval governance
// ✅ Uses sequential week lock from commercial-db.js
// ✅ Shows latest approved + pending week status
// 🚫 No KPI math changes

import {
  getStoreWeekStatus,
  saveStoreWeek,
  listStores
} from "./commercial-db.js";

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
    storeId: String(params.get("store") || "").trim(),
    districtId: String(params.get("district") || "").trim(),
    regionId: String(params.get("region") || "").trim()
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

function msg(text, isErr = false) {
  const el = $("uploadMsg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isErr ? "#b91c1c" : "#065f46";
}

function scopeMsg(text, isErr = false) {
  const el = $("scopeMsg");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isErr ? "#b91c1c" : "#065f46";
}

function currentScope() {
  return {
    orgId: String($("regionSelector")?.dataset.orgId || "").trim() ||
      String(getParams().orgId || "").trim() ||
      String(readSession()?.orgId || "").trim(),
    regionId: String($("regionSelector")?.value || "").trim(),
    districtId: String($("districtSelector")?.value || "").trim(),
    storeId: String($("storeSelector")?.value || "").trim()
  };
}

function updateUrlFromScope() {
  const scope = currentScope();
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

function buildScopedUrl(path) {
  const scope = currentScope();
  const next = new URL(path, window.location.href);

  if (scope.orgId) next.searchParams.set("org", scope.orgId);
  if (scope.regionId) next.searchParams.set("region", scope.regionId);
  if (scope.districtId) next.searchParams.set("district", scope.districtId);
  if (scope.storeId) next.searchParams.set("store", scope.storeId);

  return next.toString();
}

/* =========================================================
   Header / nav
========================================================= */

function setUploadHeaderContext() {
  const s = readSession() || {};
  const p = getParams();

  const role = String(s.role || "sm").toUpperCase();
  const orgId = p.orgId || s.orgId || "N/A";
  const storeId = p.storeId || s.storeId || "";
  const districtId = p.districtId || "";
  const regionId = p.regionId || "";

  setText(
    "uploadContext",
    `Org: ${orgId} | Role: ${role} | Upload Workspace`
  );

  const scopeBits = [];
  if (storeId) scopeBits.push(`Store: ${prettyLabel(storeId)}`);
  if (districtId) scopeBits.push(`District: ${prettyLabel(districtId)}`);
  if (regionId) scopeBits.push(`Region: ${prettyLabel(regionId)}`);

  setText(
    "uploadScope",
    scopeBits.length ? scopeBits.join(" | ") : "Store Scope: No store selected"
  );
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  selector.value = "sm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      window.location.href = buildScopedUrl("./commercial-vp.html");
      return;
    }

    if (view === "rm") {
      window.location.href = buildScopedUrl("./commercial-rm.html");
      return;
    }

    if (view === "dm") {
      window.location.href = buildScopedUrl("./commercial-dm.html");
      return;
    }

    window.location.href = buildScopedUrl("./commercial-weekly-upload.html");
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

function setupCsvInfo() {
  const input = $("dailyCsvFile");
  const info = $("csvInfo");
  if (!input || !info) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    info.textContent = file ? `Selected CSV: ${file.name}` : "No CSV selected.";
  });
}

/* =========================================================
   CSV parsing
========================================================= */

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read CSV file."));
    reader.readAsText(file);
  });
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out.map(v => String(v || "").trim());
}

function parseCsvTextToRows(text, kind = "CSV") {
  const raw = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!raw) throw new Error(`${kind} file is empty.`);

  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(`${kind} must include a header row and at least one data row.`);
  }

  const headers = parseCsvLine(lines[0]);
  if (!headers.length || headers.every(h => !h)) {
    throw new Error(`${kind} header row is invalid.`);
  }

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });

    return row;
  });

  if (!rows.length) {
    throw new Error(`No rows were found in the ${kind}.`);
  }

  return rows;
}

/* =========================================================
   Date / status helpers
========================================================= */

function addDaysIso(dateStr, days) {
  const d = new Date(`${String(dateStr || "").trim()}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function inferNextRequiredWeek(status) {
  if (status?.pendingWeek?.weekStart) {
    return {
      weekStart: status.pendingWeek.weekStart,
      blocked: true,
      reason: `Blocked — previous submission for ${status.pendingWeek.weekStart} is still pending approval.`
    };
  }

  if (status?.latestApprovedWeek?.weekStart) {
    const nextWeek = addDaysIso(status.latestApprovedWeek.weekStart, 7);
    return {
      weekStart: nextWeek,
      blocked: false,
      reason: `Next required week is ${nextWeek}.`
    };
  }

  return {
    weekStart: "",
    blocked: false,
    reason: "No approved week found yet. Start with the first required commercial week for this store."
  };
}

/* =========================================================
   Scope selectors
========================================================= */

let ALL_STORES = [];

function uniqueValues(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function fillSelect(selectId, values, selected = "", placeholder = "Select") {
  const el = $(selectId);
  if (!el) return;

  const safeValues = uniqueValues(values).sort((a, b) => a.localeCompare(b));
  el.innerHTML = "";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = placeholder;
  el.appendChild(blank);

  safeValues.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = prettyLabel(value);
    if (value === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

function getRoleScopeDefaults(stores, params, session) {
  const role = String(session?.role || "sm").toLowerCase();

  const assignedStoreIds = Array.isArray(session?.assigned_store_ids) ? session.assigned_store_ids : [];
  const assignedDistrictIds = Array.isArray(session?.assigned_district_ids) ? session.assigned_district_ids : [];
  const assignedRegionIds = Array.isArray(session?.assigned_region_ids) ? session.assigned_region_ids : [];

  let allowed = Array.isArray(stores) ? [...stores] : [];

  if (role === "sm" && assignedStoreIds.length) {
    allowed = allowed.filter((s) => assignedStoreIds.includes(s.id));
  }

  if (role === "dm" && assignedStoreIds.length) {
    allowed = allowed.filter((s) => assignedStoreIds.includes(s.id));
  }

  if (role === "dm" && !assignedStoreIds.length && assignedDistrictIds.length) {
    allowed = allowed.filter((s) => assignedDistrictIds.includes(String(s.districtId || "").trim()));
  }

  if (role === "rm" && assignedRegionIds.length) {
    allowed = allowed.filter((s) => assignedRegionIds.includes(String(s.regionId || "").trim()));
  }

  const defaultRegion =
    params.regionId ||
    (role === "rm" && assignedRegionIds[0]) ||
    (role === "dm" ? String(allowed[0]?.regionId || "") : "") ||
    String(allowed[0]?.regionId || "");

  const regionFiltered = defaultRegion
    ? allowed.filter((s) => String(s.regionId || "").trim() === defaultRegion)
    : allowed;

  const defaultDistrict =
    params.districtId ||
    (role === "dm" && assignedDistrictIds[0]) ||
    String(regionFiltered[0]?.districtId || "");

  const districtFiltered = defaultDistrict
    ? regionFiltered.filter((s) => String(s.districtId || "").trim() === defaultDistrict)
    : regionFiltered;

  const defaultStore =
    params.storeId ||
    (role === "sm" && assignedStoreIds[0]) ||
    String(districtFiltered[0]?.id || "");

  return {
    allowed,
    defaultRegion,
    defaultDistrict,
    defaultStore
  };
}

function refreshDistrictSelector() {
  const regionId = String($("regionSelector")?.value || "").trim();
  const districtValues = ALL_STORES
    .filter((s) => !regionId || String(s.regionId || "").trim() === regionId)
    .map((s) => String(s.districtId || "").trim())
    .filter(Boolean);

  const currentDistrict = String($("districtSelector")?.value || "").trim();
  fillSelect("districtSelector", districtValues, districtValues.includes(currentDistrict) ? currentDistrict : "", "Select district");
}

function refreshStoreSelector() {
  const regionId = String($("regionSelector")?.value || "").trim();
  const districtId = String($("districtSelector")?.value || "").trim();

  const storeValues = ALL_STORES
    .filter((s) => (!regionId || String(s.regionId || "").trim() === regionId))
    .filter((s) => (!districtId || String(s.districtId || "").trim() === districtId))
    .map((s) => ({ id: s.id, name: s.name }));

  const el = $("storeSelector");
  if (!el) return;

  const currentStore = String(el.value || "").trim();
  el.innerHTML = "";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Select store";
  el.appendChild(blank);

  storeValues
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
    .forEach((store) => {
      const opt = document.createElement("option");
      opt.value = store.id;
      opt.textContent = prettyLabel(store.name || store.id);
      if (store.id === currentStore) opt.selected = true;
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

  $("regionSelector").dataset.orgId = orgId;

  const stores = await listStores(orgId);
  const activeStores = (stores || []).filter((s) => s.active !== false && s.archived !== true);

  const { allowed, defaultRegion, defaultDistrict, defaultStore } = getRoleScopeDefaults(activeStores, params, session);
  ALL_STORES = allowed;

  const regions = ALL_STORES.map((s) => String(s.regionId || "").trim()).filter(Boolean);
  fillSelect("regionSelector", regions, defaultRegion, "Select region");

  refreshDistrictSelector();

  if ($("districtSelector") && defaultDistrict) {
    $("districtSelector").value = defaultDistrict;
  }

  refreshStoreSelector();

  if ($("storeSelector") && defaultStore) {
    $("storeSelector").value = defaultStore;
  }

  $("regionSelector")?.addEventListener("change", async () => {
    refreshDistrictSelector();
    refreshStoreSelector();
    updateUrlFromScope();
    setUploadHeaderContext();
    await refreshWeeklyStatus();
    await refreshDistrictCoverage();
  });

  $("districtSelector")?.addEventListener("change", async () => {
    refreshStoreSelector();
    updateUrlFromScope();
    setUploadHeaderContext();
    await refreshWeeklyStatus();
    await refreshDistrictCoverage();
  });

  $("storeSelector")?.addEventListener("change", async () => {
    updateUrlFromScope();
    setUploadHeaderContext();
    await refreshWeeklyStatus();
  });

  if (ALL_STORES.length) {
    scopeMsg(`✅ Scope loaded. ${ALL_STORES.length} active store(s) available.`);
  } else {
    scopeMsg("No active stores available in current scope.", true);
  }

  updateUrlFromScope();
}

/* =========================================================
   Weekly status / coverage
========================================================= */

async function refreshWeeklyStatus() {
  const scope = currentScope();

  if (!scope.orgId || !scope.storeId) {
    setText("requiredWeekText", "Select a store to view required week status.");
    setText("weeklyStatusText", "Select a store to view weekly upload status.");
    return;
  }

  try {
    const status = await getStoreWeekStatus(scope.orgId, scope.storeId);
    const requirement = inferNextRequiredWeek(status);

    setText("requiredWeekText", requirement.reason);

    if (!status?.latestApprovedWeek && !status?.pendingWeek && !status?.latestWeek) {
      setText(
        "weeklyStatusText",
        `STORE: ${scope.storeId}\n\nNo weekly uploads found yet.\n\nStatus: ACTION_NEEDED\nRequired: First commercial week upload`
      );
      if (!requirement.blocked && $("weekStartInput") && !$("weekStartInput").value && requirement.weekStart) {
        $("weekStartInput").value = requirement.weekStart;
      }
      return;
    }

    let output = "";
    output += `STORE: ${scope.storeId}\n`;
    output += `DISTRICT: ${scope.districtId || "N/A"}\n`;
    output += `REGION: ${scope.regionId || "N/A"}\n\n`;

    if (status?.latestApprovedWeek) {
      output += `LATEST APPROVED WEEK:\n`;
      output += `ID: ${status.latestApprovedWeek.id || status.latestApprovedWeek.weekId || "N/A"}\n`;
      output += `WEEK START: ${status.latestApprovedWeek.weekStart || "N/A"}\n`;
      output += `ROWS: ${status.latestApprovedWeek.rowCount || 0}\n`;
      output += `STATUS: ${status.latestApprovedWeek.status || "approved"}\n\n`;
    } else {
      output += `LATEST APPROVED WEEK:\nNone\n\n`;
    }

    if (status?.pendingWeek) {
      output += `PENDING WEEK:\n`;
      output += `ID: ${status.pendingWeek.id || status.pendingWeek.weekId || "N/A"}\n`;
      output += `WEEK START: ${status.pendingWeek.weekStart || "N/A"}\n`;
      output += `ROWS: ${status.pendingWeek.rowCount || 0}\n`;
      output += `STATUS: ${status.pendingWeek.status || "pending"}\n\n`;
    } else {
      output += `PENDING WEEK:\nNone\n\n`;
    }

    output += `NEXT REQUIRED WEEK:\n${requirement.weekStart || "First required week not yet set"}\n`;

    setText("weeklyStatusText", output);

    if (!status?.pendingWeek && requirement.weekStart && $("weekStartInput") && !$("weekStartInput").value) {
      $("weekStartInput").value = requirement.weekStart;
    }
  } catch (e) {
    console.error("[commercial-weekly-upload] refreshWeeklyStatus failed:", e);
    setText("requiredWeekText", "Unable to load required week status.");
    setText("weeklyStatusText", "Weekly upload status unavailable right now.");
  }
}

async function refreshDistrictCoverage() {
  const scope = currentScope();

  if (!scope.orgId || !scope.districtId) {
    setText("districtCoverageText", "Select a district to view upload coverage.");
    return;
  }

  try {
    const districtStores = ALL_STORES
      .filter((s) => String(s.districtId || "").trim() === scope.districtId)
      .filter((s) => !scope.regionId || String(s.regionId || "").trim() === scope.regionId);

    if (!districtStores.length) {
      setText("districtCoverageText", "No active stores found in selected district.");
      return;
    }

    const lines = [];
    lines.push(`DISTRICT: ${scope.districtId}`);
    lines.push(`REGION: ${scope.regionId || "N/A"}`);
    lines.push("");

    for (const store of districtStores) {
      const status = await getStoreWeekStatus(scope.orgId, store.id);
      const requirement = inferNextRequiredWeek(status);

      let readiness = "ACTION_NEEDED";
      if (status?.pendingWeek) readiness = "PENDING_APPROVAL";
      else if (status?.latestApprovedWeek) readiness = "APPROVED";

      lines.push(`${store.id} | ${prettyLabel(store.name || store.id)}`);
      lines.push(`status=${readiness}`);
      lines.push(`latestApproved=${status?.latestApprovedWeek?.weekStart || "none"}`);
      lines.push(`pendingWeek=${status?.pendingWeek?.weekStart || "none"}`);
      lines.push(`nextRequired=${requirement.weekStart || "first_week"}`);
      lines.push("");
    }

    setText("districtCoverageText", lines.join("\n"));
  } catch (e) {
    console.error("[commercial-weekly-upload] refreshDistrictCoverage failed:", e);
    setText("districtCoverageText", "District upload coverage unavailable right now.");
  }
}

/* =========================================================
   Save upload
========================================================= */

async function onSaveWeeklyUpload() {
  try {
    const session = readSession();
    const scope = currentScope();

    const orgId = String(scope.orgId || session?.orgId || "").trim();
    const storeId = String(scope.storeId || session?.storeId || "").trim();
    const weekStart = String($("weekStartInput")?.value || "").trim();
    const file = $("dailyCsvFile")?.files?.[0];

    if (!orgId) throw new Error("Org Id required.");
    if (!storeId) throw new Error("Store Id required. Select a store first.");
    if (!weekStart) throw new Error("Week Start required.");
    if (!file) throw new Error("Daily CSV file is required.");

    msg("Reading daily CSV…");

    const csvText = await readFileAsText(file);
    const rows = parseCsvTextToRows(csvText, "Daily CSV");

    msg("Saving weekly upload…");

    const noteRole = String(session?.role || "sm").toUpperCase();
    const weekId = await saveStoreWeek({
      orgId,
      storeId,
      weekStart,
      rows,
      uploadedByUid: session?.uid || null,
      uploadedByEmail: session?.email || null,
      note: `${noteRole} daily row upload`
    });

    msg(`✅ Weekly upload saved as pending approval.\nStore: ${storeId}\nWeek ID: ${weekId}\nRows: ${rows.length}`);

    await refreshWeeklyStatus();
    await refreshDistrictCoverage();
  } catch (e) {
    msg("❌ " + (e?.message || "Failed to save weekly upload"), true);
  }
}

/* =========================================================
   Init
========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  setUploadHeaderContext();
  setupViewSelector();
  setupLogout();
  setupCsvInfo();
  await setupScopeSelectors();

  $("saveWeeklyUploadBtn")?.addEventListener("click", onSaveWeeklyUpload);
  $("refreshWeeklyStatusBtn")?.addEventListener("click", async () => {
    await refreshWeeklyStatus();
    await refreshDistrictCoverage();
  });

  await refreshWeeklyStatus();
  await refreshDistrictCoverage();
});