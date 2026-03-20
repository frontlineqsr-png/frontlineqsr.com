// /assets/commercial-admin.js (v10)
// Commercial admin workspace logic + RESET controls
// ✅ Adds delete week / delete baseline / full reset
// 🚫 No KPI math changes

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
  getStoreWeekStatus,

  // ✅ NEW
  deleteStoreWeek,
  deleteStoreBaseline,
  resetStoreData

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

function currentSession() {
  const s = readSession();
  if (!s?.uid) throw new Error("Missing commercial session.");
  return s;
}

function confirmDelete() {
  const val = String($("resetConfirmText")?.value || "").trim().toUpperCase();
  if (val !== "DELETE") {
    throw new Error("Type DELETE to confirm.");
  }
}

/* =========================================================
   RESET ACTIONS (NEW)
========================================================= */

async function onDeleteWeek() {
  try {
    confirmDelete();

    const session = currentSession();
    const orgId = $("resetOrgId")?.value.trim();
    const storeId = $("resetStoreId")?.value.trim();
    const weekId = $("resetWeekId")?.value.trim();

    if (!orgId || !storeId || !weekId) {
      throw new Error("Org, Store, and Week ID required.");
    }

    msg("resetMsg", "Deleting week…");

    await deleteStoreWeek({
      orgId,
      storeId,
      weekId,
      deletedByUid: session.uid,
      deletedByEmail: session.email
    });

    msg("resetMsg", `✅ Week deleted: ${weekId}`);

    await refreshLists();
  } catch (e) {
    msg("resetMsg", "❌ " + e.message, true);
  }
}

async function onDeleteBaseline() {
  try {
    confirmDelete();

    const session = currentSession();
    const orgId = $("resetOrgId")?.value.trim();
    const storeId = $("resetStoreId")?.value.trim();

    if (!orgId || !storeId) {
      throw new Error("Org and Store required.");
    }

    msg("resetMsg", "Deleting baseline…");

    await deleteStoreBaseline({
      orgId,
      storeId,
      deletedByUid: session.uid,
      deletedByEmail: session.email
    });

    msg("resetMsg", "✅ Baseline deleted");

    await refreshLists();
  } catch (e) {
    msg("resetMsg", "❌ " + e.message, true);
  }
}

async function onResetStore() {
  try {
    confirmDelete();

    const session = currentSession();
    const orgId = $("resetOrgId")?.value.trim();
    const storeId = $("resetStoreId")?.value.trim();

    if (!orgId || !storeId) {
      throw new Error("Org and Store required.");
    }

    msg("resetMsg", "Resetting store…");

    await resetStoreData({
      orgId,
      storeId,
      resetByUid: session.uid,
      resetByEmail: session.email
    });

    msg("resetMsg", "✅ Store fully reset");

    await refreshLists();
  } catch (e) {
    msg("resetMsg", "❌ " + e.message, true);
  }
}

/* =========================================================
   EXISTING FUNCTIONS (UNCHANGED)
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
      const activeStores = (stores || []).filter(s => s.active !== false);

      if ($("storeList")) {
        $("storeList").textContent =
          activeStores.map(s =>
            `${s.id} | ${s.name} | active=${s.active !== false} | approved=${!!s.baselineApproved} | latestWeek=${s.latestWeekStart || "none"}`
          ).join("\n") || "(none)";
      }
    }

    msg("globalMsg", "✅ Refreshed.");
  } catch (e) {
    msg("globalMsg", "❌ Failed", true);
  }
}

/* =========================================================
   INIT
========================================================= */

window.addEventListener("DOMContentLoaded", () => {

  // Existing bindings stay

  $("refreshBtn")?.addEventListener("click", refreshLists);

  // ✅ NEW BUTTONS
  $("deleteWeekBtn")?.addEventListener("click", onDeleteWeek);
  $("deleteBaselineBtn")?.addEventListener("click", onDeleteBaseline);
  $("resetStoreBtn")?.addEventListener("click", onResetStore);

  refreshLists().catch(() => {});
});