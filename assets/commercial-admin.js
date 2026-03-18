// /assets/commercial-admin.js (v8)
// Commercial admin workspace logic
// CSV baseline intake + weekly upload intake + governance
// Syncs org/store values across admin sections for speed

import {
  createOrg,
  createStore,
  upsertUserAccess,
  listOrgs,
  listStores,
  savePendingStoreBaseline,
  getStoreBaselineStatus,
  approvePendingStoreBaseline,
  saveStoreWeek,
  getStoreWeekStatus
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

function msg(elId, text, isErr = false) {
  const el = $(elId);
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isErr ? "#b91c1c" : "#065f46";
}

function parseCsvIds(s) {
  return String(s || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function currentSession() {
  const s = readSession();
  if (!s?.uid) throw new Error("Missing commercial session.");
  return s;
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value || "";
}

function syncOrgIdEverywhere(orgId) {
  setValue("storeOrgId", orgId);
  setValue("u_orgId", orgId);
  setValue("listOrgId", orgId);
  setValue("inspectOrgId", orgId);
  setValue("baselineOrgId", orgId);
  setValue("baselineIntakeOrgId", orgId);
  setValue("weeklyOrgId", orgId);
}

function syncStoreIdEverywhere(storeId) {
  setValue("inspectStoreId", storeId);
  setValue("baselineStoreId", storeId);
  setValue("baselineIntakeStoreId", storeId);
  setValue("weeklyStoreId", storeId);
}

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
   Header
========================================================= */

function setAdminHeaderContext() {
  const s = readSession();
  if (!s) return;

  const role = String(s.role || "admin").toUpperCase();
  const orgId = s.orgId || "Platform scope";

  const extra = $("adminContext");
  if (extra) {
    extra.textContent = `Org: ${orgId} | Role: ${role} | Admin Workspace`;
  }
}

/* =========================================================
   ORG + STORE + USER
========================================================= */

async function onCreateOrg() {
  try {
    const session = currentSession();
    const name = String($("orgName")?.value || "").trim();
    if (!name) throw new Error("Org Name required.");

    msg("orgMsg", "Creating org…");
    const orgId = await createOrg({
      name,
      createdByUid: session.uid,
      createdByEmail: session.email
    });

    msg("orgMsg", "✅ Org created.");
    if ($("orgIdOut")) $("orgIdOut").textContent = orgId;

    syncOrgIdEverywhere(orgId);
  } catch (e) {
    msg("orgMsg", "❌ " + e.message, true);
  }
}

async function onCreateStore() {
  try {
    const orgId = String($("storeOrgId")?.value || "").trim();
    const name = String($("storeName")?.value || "").trim();
    const regionId = String($("regionId")?.value || "").trim();
    const districtId = String($("districtId")?.value || "").trim();

    if (!orgId) throw new Error("Org Id required.");
    if (!name) throw new Error("Store Name required.");

    msg("storeMsg", "Creating store…");
    const storeId = await createStore({ orgId, name, regionId, districtId });

    msg("storeMsg", `✅ Store created: ${storeId}`);

    syncOrgIdEverywhere(orgId);
    syncStoreIdEverywhere(storeId);

    if ($("inspectRegionId") && regionId) $("inspectRegionId").value = regionId;
    if ($("inspectDistrictId") && districtId) $("inspectDistrictId").value = districtId;
  } catch (e) {
    msg("storeMsg", "❌ " + e.message, true);
  }
}

async function onSaveUser() {
  try {
    const uid = String($("u_uid")?.value || "").trim();
    const email = String($("u_email")?.value || "").trim().toLowerCase();
    const orgId = String($("u_orgId")?.value || "").trim();
    const role = String($("u_role")?.value || "SM").trim().toUpperCase();

    msg("userMsg", "Saving user…");

    await upsertUserAccess({
      uid,
      email,
      orgId,
      role,
      commercialAccess: !!$("u_commercial")?.checked,
      active: !!$("u_active")?.checked,
      assignedStoreIds: parseCsvIds($("u_storeIds")?.value || ""),
      assignedDistrictIds: [],
      assignedRegionIds: [],
      isSuperAdmin: role === "SUPER_ADMIN"
    });

    msg("userMsg", "✅ User saved");
  } catch (e) {
    msg("userMsg", "❌ " + e.message, true);
  }
}

/* =========================================================
   Inspection Launch
========================================================= */

function buildLaunchUrl(level) {
  const orgId = String($("inspectOrgId")?.value || "").trim();
  const regionId = String($("inspectRegionId")?.value || "").trim();
  const districtId = String($("inspectDistrictId")?.value || "").trim();
  const storeId = String($("inspectStoreId")?.value || "").trim();

  let path = "./commercial-vp.html";
  if (level === "rm") path = "./commercial-rm.html";
  if (level === "dm") path = "./commercial-dm.html";
  if (level === "sm") path = "./commercial-portal.html";

  const next = new URL(path, window.location.href);

  if (orgId) next.searchParams.set("org", orgId);
  if (regionId) next.searchParams.set("region", regionId);
  if (districtId) next.searchParams.set("district", districtId);
  if (storeId) next.searchParams.set("store", storeId);

  return next.toString();
}

function openLevel(level) {
  try {
    const url = buildLaunchUrl(level);

    if (level === "rm" && !String($("inspectRegionId")?.value || "").trim()) {
      msg("inspectMsg", "❌ Region Id is recommended for Region View.", true);
      return;
    }

    if (level === "dm" && !String($("inspectDistrictId")?.value || "").trim()) {
      msg("inspectMsg", "❌ District Id is recommended for District View.", true);
      return;
    }

    if (level === "sm" && !String($("inspectStoreId")?.value || "").trim()) {
      msg("inspectMsg", "❌ Store Id is required for Store View.", true);
      return;
    }

    msg("inspectMsg", `Opening ${level.toUpperCase()} view…`);
    window.location.href = url;
  } catch (e) {
    msg("inspectMsg", "❌ " + (e?.message || "Failed to open view"), true);
  }
}

/* =========================================================
   BASELINE INTAKE
========================================================= */

function setupBaselineCsvInfo() {
  const input = $("baselineCsvFile");
  const info = $("baselineCsvInfo");
  if (!input || !info) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    info.textContent = file ? `Selected CSV: ${file.name}` : "No CSV selected.";
  });
}

async function onSavePendingBaseline() {
  try {
    const session = currentSession();
    const orgId = String($("baselineIntakeOrgId")?.value || "").trim();
    const storeId = String($("baselineIntakeStoreId")?.value || "").trim();
    const label = String($("baselineLabel")?.value || "").trim();
    const year = String($("baselineYear")?.value || "").trim();
    const file = $("baselineCsvFile")?.files?.[0];

    if (!orgId) throw new Error("Baseline intake Org Id required.");
    if (!storeId) throw new Error("Baseline intake Store Id required.");
    if (!file) throw new Error("Baseline CSV file is required.");

    msg("baselineIntakeMsg", "Reading CSV…");

    const csvText = await readFileAsText(file);
    const rows = parseCsvTextToRows(csvText, "Baseline CSV");

    msg("baselineIntakeMsg", "Saving pending baseline…");

    await savePendingStoreBaseline({
      orgId,
      storeId,
      label,
      year,
      rows,
      uploadedByUid: session.uid,
      uploadedByEmail: session.email
    });

    msg("baselineIntakeMsg", `✅ Pending baseline saved. Rows: ${rows.length}`);

    setValue("baselineOrgId", orgId);
    setValue("baselineStoreId", storeId);

    await onLoadBaselineStatus();
    await refreshLists();
  } catch (e) {
    msg("baselineIntakeMsg", "❌ " + e.message, true);
  }
}

/* =========================================================
   WEEKLY INTAKE
========================================================= */

function setupWeeklyCsvInfo() {
  const input = $("weeklyCsvFile");
  const info = $("weeklyCsvInfo");
  if (!input || !info) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    info.textContent = file ? `Selected weekly CSV: ${file.name}` : "No weekly CSV selected.";
  });
}

async function onSaveWeeklyUpload() {
  try {
    const session = currentSession();
    const orgId = String($("weeklyOrgId")?.value || "").trim();
    const storeId = String($("weeklyStoreId")?.value || "").trim();
    const weekStart = String($("weeklyStart")?.value || "").trim();
    const note = String($("weeklyNote")?.value || "").trim();
    const file = $("weeklyCsvFile")?.files?.[0];

    if (!orgId) throw new Error("Weekly Org Id required.");
    if (!storeId) throw new Error("Weekly Store Id required.");
    if (!weekStart) throw new Error("Week Start required.");
    if (!file) throw new Error("Weekly CSV file is required.");

    msg("weeklyIntakeMsg", "Reading weekly CSV…");

    const csvText = await readFileAsText(file);
    const rows = parseCsvTextToRows(csvText, "Weekly CSV");

    msg("weeklyIntakeMsg", "Saving weekly upload…");

    const weekId = await saveStoreWeek({
      orgId,
      storeId,
      weekStart,
      rows,
      uploadedByUid: session.uid,
      uploadedByEmail: session.email,
      note
    });

    const status = await getStoreWeekStatus(orgId, storeId);

    let summary = `✅ Weekly upload saved.\nWeek ID: ${weekId}\nRows: ${rows.length}`;
    if (status?.latestWeek?.weekStart) {
      summary += `\nLatest Week: ${status.latestWeek.weekStart}`;
    }

    msg("weeklyIntakeMsg", summary);

    await refreshLists();
  } catch (e) {
    msg("weeklyIntakeMsg", "❌ " + e.message, true);
  }
}

/* =========================================================
   BASELINE GOVERNANCE
========================================================= */

async function onLoadBaselineStatus() {
  try {
    const orgId = String($("baselineOrgId")?.value || "").trim();
    const storeId = String($("baselineStoreId")?.value || "").trim();

    if (!orgId || !storeId) {
      throw new Error("Org + Store required.");
    }

    msg("baselineMsg", "Loading baseline status…");

    const data = await getStoreBaselineStatus(orgId, storeId);
    const weekStatus = await getStoreWeekStatus(orgId, storeId);

    let output = "";
    output += `STORE: ${storeId}\n`;
    output += `BASELINE APPROVED: ${data.baselineApproved ? "YES" : "NO"}\n`;
    output += `BASELINE LOCKED: ${data.baselineLocked ? "YES" : "NO"}\n\n`;

    if (data.activeBaseline) {
      output += `ACTIVE BASELINE:\n`;
      output += `ID: ${data.activeBaseline.id}\n`;
      output += `LABEL: ${data.activeBaseline.label || "N/A"}\n`;
      output += `YEAR: ${data.activeBaseline.year || "N/A"}\n`;
      output += `ROWS: ${data.activeBaseline.rowCount || 0}\n\n`;
    }

    if (data.pendingBaseline) {
      output += `PENDING BASELINE:\n`;
      output += `ID: ${data.pendingBaseline.id}\n`;
      output += `LABEL: ${data.pendingBaseline.label || "Pending"}\n`;
      output += `YEAR: ${data.pendingBaseline.year || "N/A"}\n`;
      output += `ROWS: ${data.pendingBaseline.rowCount || 0}\n\n`;
    }

    if (!data.activeBaseline && !data.pendingBaseline) {
      output += "No baseline found.\n\n";
    }

    if (weekStatus?.latestWeek) {
      output += `LATEST WEEK:\n`;
      output += `ID: ${weekStatus.latestWeek.id || weekStatus.latestWeek.weekId || "N/A"}\n`;
      output += `WEEK START: ${weekStatus.latestWeek.weekStart || "N/A"}\n`;
      output += `ROWS: ${weekStatus.latestWeek.rowCount || 0}\n`;
      output += `APPROVED: ${weekStatus.latestWeek.approved ? "YES" : "NO"}\n`;
    } else {
      output += `LATEST WEEK:\nNo weekly upload found.\n`;
    }

    if ($("baselineStatus")) $("baselineStatus").textContent = output;
    msg("baselineMsg", "✅ Loaded");
  } catch (e) {
    msg("baselineMsg", "❌ " + e.message, true);
  }
}

async function onApproveBaseline() {
  try {
    const session = currentSession();
    const orgId = String($("baselineOrgId")?.value || "").trim();
    const storeId = String($("baselineStoreId")?.value || "").trim();

    if (!orgId || !storeId) {
      throw new Error("Org + Store required.");
    }

    msg("baselineMsg", "Approving baseline…");

    await approvePendingStoreBaseline({
      orgId,
      storeId,
      approvedByUid: session.uid,
      approvedByEmail: session.email
    });

    msg("baselineMsg", "✅ Baseline approved");
    await onLoadBaselineStatus();
    await refreshLists();
  } catch (e) {
    msg("baselineMsg", "❌ " + e.message, true);
  }
}

/* =========================================================
   LISTS
========================================================= */

async function refreshLists() {
  try {
    const orgId = String($("listOrgId")?.value || "").trim();

    const orgs = await listOrgs();
    if ($("orgList")) {
      $("orgList").textContent =
        orgs.map(o => `${o.id} | ${o.name}`).join("\n") || "(none)";
    }

    if (orgId) {
      const stores = await listStores(orgId);
      if ($("storeList")) {
        $("storeList").textContent =
          stores.map(s =>
            `${s.id} | ${s.name} | approved=${!!s.baselineApproved} | locked=${!!s.baselineLocked} | activeBaseline=${s.activeBaselineLabel || "none"} | latestWeek=${s.latestWeekStart || "none"}`
          ).join("\n") || "(none)";
      }
    } else {
      if ($("storeList")) $("storeList").textContent = "(enter orgId to list stores)";
    }

    msg("globalMsg", "✅ Refreshed.");
  } catch (e) {
    msg("globalMsg", "❌ " + (e?.message || "Failed"), true);
  }
}

/* =========================================================
   INIT
========================================================= */

window.addEventListener("DOMContentLoaded", () => {
  setAdminHeaderContext();
  setupBaselineCsvInfo();
  setupWeeklyCsvInfo();

  $("createOrgBtn")?.addEventListener("click", onCreateOrg);
  $("createStoreBtn")?.addEventListener("click", onCreateStore);
  $("saveUserBtn")?.addEventListener("click", onSaveUser);
  $("refreshBtn")?.addEventListener("click", refreshLists);

  $("openVpBtn")?.addEventListener("click", () => openLevel("vp"));
  $("openRmBtn")?.addEventListener("click", () => openLevel("rm"));
  $("openDmBtn")?.addEventListener("click", () => openLevel("dm"));
  $("openSmBtn")?.addEventListener("click", () => openLevel("sm"));

  $("saveBaselineBtn")?.addEventListener("click", onSavePendingBaseline);
  $("saveWeeklyBtn")?.addEventListener("click", onSaveWeeklyUpload);
  $("loadBaselineBtn")?.addEventListener("click", onLoadBaselineStatus);
  $("approveBaselineBtn")?.addEventListener("click", onApproveBaseline);

  refreshLists().catch(() => {});
});