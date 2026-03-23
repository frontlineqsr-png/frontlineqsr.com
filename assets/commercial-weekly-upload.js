// /assets/commercial-weekly-upload.js (v1)
// Commercial weekly upload page
// ✅ Store uploads DAILY rows for one required week
// ✅ Uses commercial-db.js weekly save flow
// ✅ Uses pending approval governance
// ✅ Uses sequential week lock from commercial-db.js
// ✅ Shows latest approved + pending week status
// 🚫 No KPI math changes

import {
  getStoreWeekStatus,
  saveStoreWeek
} from "./commercial-db.js";

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

function setUploadHeaderContext() {
  const s = readSession() || {};
  const p = getParams();

  const role = String(s.role || "sm").toUpperCase();
  const orgId = p.orgId || s.orgId || "N/A";
  const storeId = p.storeId || s.storeId || "";

  setText(
    "uploadContext",
    `Org: ${orgId} | Role: ${role} | Upload Workspace`
  );

  setText(
    "uploadScope",
    storeId
      ? `Store Scope: ${prettyLabel(storeId)}`
      : "Store Scope: No store selected"
  );
}

function setupViewSelector() {
  const selector = $("viewSelector");
  if (!selector) return;

  const p = getParams();
  selector.value = "sm";

  selector.addEventListener("change", (e) => {
    const view = String(e.target.value || "").trim();

    if (view === "vp") {
      const next = new URL("./commercial-vp.html", window.location.href);
      if (p.orgId) next.searchParams.set("org", p.orgId);
      if (p.regionId) next.searchParams.set("region", p.regionId);
      if (p.districtId) next.searchParams.set("district", p.districtId);
      if (p.storeId) next.searchParams.set("store", p.storeId);
      window.location.href = next.toString();
      return;
    }

    if (view === "rm") {
      const next = new URL("./commercial-rm.html", window.location.href);
      if (p.orgId) next.searchParams.set("org", p.orgId);
      if (p.regionId) next.searchParams.set("region", p.regionId);
      if (p.districtId) next.searchParams.set("district", p.districtId);
      if (p.storeId) next.searchParams.set("store", p.storeId);
      window.location.href = next.toString();
      return;
    }

    if (view === "dm") {
      const next = new URL("./commercial-dm.html", window.location.href);
      if (p.orgId) next.searchParams.set("org", p.orgId);
      if (p.districtId) next.searchParams.set("district", p.districtId);
      if (p.regionId) next.searchParams.set("region", p.regionId);
      if (p.storeId) next.searchParams.set("store", p.storeId);
      window.location.href = next.toString();
      return;
    }

    const next = new URL("./commercial-weekly-upload.html", window.location.href);
    if (p.orgId) next.searchParams.set("org", p.orgId);
    if (p.storeId) next.searchParams.set("store", p.storeId);
    if (p.districtId) next.searchParams.set("district", p.districtId);
    if (p.regionId) next.searchParams.set("region", p.regionId);
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

function setupCsvInfo() {
  const input = $("dailyCsvFile");
  const info = $("csvInfo");
  if (!input || !info) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    info.textContent = file ? `Selected CSV: ${file.name}` : "No CSV selected.";
  });
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

async function refreshWeeklyStatus() {
  const p = getParams();
  if (!p.orgId || !p.storeId) {
    setText("requiredWeekText", "Missing org or store context.");
    setText("weeklyStatusText", "Unable to load weekly status.");
    return;
  }

  try {
    const status = await getStoreWeekStatus(p.orgId, p.storeId);
    const requirement = inferNextRequiredWeek(status);

    setText("requiredWeekText", requirement.reason);

    if (!status?.latestApprovedWeek && !status?.pendingWeek && !status?.latestWeek) {
      setText(
        "weeklyStatusText",
        "No weekly uploads found yet.\n\nStatus: ACTION_NEEDED\nRequired: First commercial week upload"
      );
      return;
    }

    let output = "";
    output += `STORE: ${p.storeId}\n\n`;

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

async function onSaveWeeklyUpload() {
  try {
    const session = readSession();
    const p = getParams();

    const orgId = String(p.orgId || session?.orgId || "").trim();
    const storeId = String(p.storeId || session?.storeId || "").trim();
    const weekStart = String($("weekStartInput")?.value || "").trim();
    const file = $("dailyCsvFile")?.files?.[0];

    if (!orgId) throw new Error("Org Id required.");
    if (!storeId) throw new Error("Store Id required.");
    if (!weekStart) throw new Error("Week Start required.");
    if (!file) throw new Error("Daily CSV file is required.");

    msg("Reading daily CSV…");

    const csvText = await readFileAsText(file);
    const rows = parseCsvTextToRows(csvText, "Daily CSV");

    msg("Saving weekly upload…");

    const weekId = await saveStoreWeek({
      orgId,
      storeId,
      weekStart,
      rows,
      uploadedByUid: session?.uid || null,
      uploadedByEmail: session?.email || null,
      note: "Store daily row upload"
    });

    msg(`✅ Weekly upload saved as pending approval.\nWeek ID: ${weekId}\nRows: ${rows.length}`);
    await refreshWeeklyStatus();
  } catch (e) {
    msg("❌ " + (e?.message || "Failed to save weekly upload"), true);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  setUploadHeaderContext();
  setupViewSelector();
  setupLogout();
  setupCsvInfo();

  $("saveWeeklyUploadBtn")?.addEventListener("click", onSaveWeeklyUpload);
  $("refreshWeeklyStatusBtn")?.addEventListener("click", refreshWeeklyStatus);

  await refreshWeeklyStatus();
});