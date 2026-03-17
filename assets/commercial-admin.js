// /assets/commercial-admin.js (v4)
// Commercial admin workspace logic
// Adds baseline governance (load + approve)

import {
  createOrg,
  createStore,
  upsertUserAccess,
  listOrgs,
  listStores,
  getStoreBaselineStatus,
  approvePendingStoreBaseline
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
   ORG + STORE + USER (UNCHANGED)
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

    $("storeOrgId").value = orgId;
    $("u_orgId").value = orgId;
    $("listOrgId").value = orgId;
    $("inspectOrgId").value = orgId;

  } catch (e) {
    msg("orgMsg", "❌ " + e.message, true);
  }
}

async function onCreateStore() {
  try {
    const orgId = $("storeOrgId").value.trim();
    const name = $("storeName").value.trim();

    msg("storeMsg", "Creating store…");
    const storeId = await createStore({ orgId, name });

    msg("storeMsg", `✅ Store created: ${storeId}`);
    $("inspectStoreId").value = storeId;

  } catch (e) {
    msg("storeMsg", "❌ " + e.message, true);
  }
}

async function onSaveUser() {
  try {
    const uid = $("u_uid").value.trim();
    const email = $("u_email").value.trim().toLowerCase();
    const orgId = $("u_orgId").value.trim();
    const role = $("u_role").value;

    msg("userMsg", "Saving user…");

    await upsertUserAccess({
      uid,
      email,
      orgId,
      role,
      commercialAccess: true,
      active: true,
      assignedStoreIds: parseCsvIds($("u_storeIds").value),
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
   BASELINE GOVERNANCE (NEW)
========================================================= */

async function onLoadBaselineStatus() {
  try {
    const orgId = $("inspectOrgId").value.trim();
    const storeId = $("inspectStoreId").value.trim();

    if (!orgId || !storeId) {
      throw new Error("Org + Store required.");
    }

    msg("baselineMsg", "Loading baseline status…");

    const data = await getStoreBaselineStatus(orgId, storeId);

    let output = "";

    if (data.activeBaseline) {
      output += `ACTIVE BASELINE:\n`;
      output += `${data.activeBaseline.label || "N/A"}\n\n`;
    }

    if (data.pendingBaseline) {
      output += `PENDING BASELINE:\n`;
      output += `${data.pendingBaseline.label || "Pending"}\n\n`;
    }

    if (!data.activeBaseline && !data.pendingBaseline) {
      output = "No baseline found.";
    }

    $("baselineStatus").textContent = output;
    msg("baselineMsg", "✅ Loaded");

  } catch (e) {
    msg("baselineMsg", "❌ " + e.message, true);
  }
}

async function onApproveBaseline() {
  try {
    const session = currentSession();
    const orgId = $("inspectOrgId").value.trim();
    const storeId = $("inspectStoreId").value.trim();

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

  } catch (e) {
    msg("baselineMsg", "❌ " + e.message, true);
  }
}

/* =========================================================
   LISTS
========================================================= */

async function refreshLists() {
  const orgId = $("listOrgId").value.trim();

  const orgs = await listOrgs();
  $("orgList").textContent =
    orgs.map(o => `${o.id} | ${o.name}`).join("\n");

  if (orgId) {
    const stores = await listStores(orgId);
    $("storeList").textContent =
      stores.map(s => `${s.id} | ${s.name} | approved=${s.baselineApproved}`).join("\n");
  }
}

/* =========================================================
   INIT
========================================================= */

window.addEventListener("DOMContentLoaded", () => {
  setAdminHeaderContext();

  $("createOrgBtn")?.addEventListener("click", onCreateOrg);
  $("createStoreBtn")?.addEventListener("click", onCreateStore);
  $("saveUserBtn")?.addEventListener("click", onSaveUser);
  $("refreshBtn")?.addEventListener("click", refreshLists);

  $("loadBaselineBtn")?.addEventListener("click", onLoadBaselineStatus);
  $("approveBaselineBtn")?.addEventListener("click", onApproveBaseline);

  refreshLists();
});