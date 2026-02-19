// /assets/commercial-admin.js
// Step 1 — Org + Store + User Assignment (Commercial)
// NO PILOT DATA. NO KPI MATH.

import { getCommercialSession, clearCommercialSession } from "./commercial-guard.js";
import { createOrg, createStore, upsertUserAccess, listOrgs, listStores } from "./commercial-db.js";

const $ = (id) => document.getElementById(id);

function msg(elId, text, isErr=false){
  const el = $(elId);
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isErr ? "#b91c1c" : "#065f46";
}

function parseCsvIds(s){
  return String(s || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function requireSession(){
  const s = getCommercialSession();
  if (!s?.uid) throw new Error("Missing commercial session. Re-login.");
  return s;
}

async function onCreateOrg(){
  try {
    const s = requireSession();
    const name = String($("orgName")?.value || "").trim();
    if (!name) throw new Error("Org Name required.");

    msg("orgMsg", "Creating org…");
    const orgId = await createOrg({ name, createdByUid: s.uid, createdByEmail: s.email });
    msg("orgMsg", "✅ Org created.");
    $("orgIdOut").textContent = `orgId: ${orgId}`;

    // convenience fill
    $("storeOrgId").value = orgId;
    $("u_orgId").value = orgId;
    $("listOrgId").value = orgId;

  } catch (e) {
    console.error(e);
    msg("orgMsg", "❌ " + (e?.message || "Failed"), true);
  }
}

async function onCreateStore(){
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
  } catch (e) {
    console.error(e);
    msg("storeMsg", "❌ " + (e?.message || "Failed"), true);
  }
}

async function onSaveUser(){
  try {
    const s = requireSession();

    const uid = String($("u_uid")?.value || "").trim();
    const email = String($("u_email")?.value || "").trim().toLowerCase();
    const orgId = String($("u_orgId")?.value || "").trim();
    const role = String($("u_role")?.value || "SM").trim().toUpperCase();
    const commercialAccess = !!$("u_commercial")?.checked;
    const active = !!$("u_active")?.checked;

    const assignedStoreIds = parseCsvIds($("u_storeIds")?.value || "");

    if (!uid) throw new Error("User UID required.");
    if (!email) throw new Error("Email required.");

    // Only allow blank orgId if SUPER_ADMIN
    if (!orgId && role !== "SUPER_ADMIN") throw new Error("Org Id required for non-super-admin.");

    msg("userMsg", "Saving user access…");

    const isSuperAdmin = (role === "SUPER_ADMIN");
    await upsertUserAccess({
      uid,
      email,
      orgId,
      role,
      commercialAccess,
      active,
      assignedStoreIds,
      assignedDistrictIds: [],
      assignedRegionIds: [],
      isSuperAdmin
    });

    msg("userMsg", "✅ User access saved (commercial_users + orgs/{orgId}/users).");
  } catch (e) {
    console.error(e);
    msg("userMsg", "❌ " + (e?.message || "Failed"), true);
  }
}

async function refreshLists(){
  try {
    msg("globalMsg", "Refreshing…");
    const orgs = await listOrgs();
    $("orgList").textContent = orgs.map(o => `${o.id}  |  ${o.name}  |  active=${!!o.active}`).join("\n") || "(none)";

    const orgId = String($("listOrgId")?.value || "").trim();
    if (orgId) {
      const stores = await listStores(orgId);
      $("storeList").textContent = stores.map(st => `${st.id}  |  ${st.name}  |  baselineLocked=${!!st.baselineLocked}`).join("\n") || "(none)";
    } else {
      $("storeList").textContent = "(enter orgId to list stores)";
    }

    msg("globalMsg", "✅ Refreshed.");
  } catch (e) {
    console.error(e);
    msg("globalMsg", "❌ " + (e?.message || "Failed"), true);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  $("createOrgBtn")?.addEventListener("click", onCreateOrg);
  $("createStoreBtn")?.addEventListener("click", onCreateStore);
  $("saveUserBtn")?.addEventListener("click", onSaveUser);
  $("refreshBtn")?.addEventListener("click", refreshLists);

  // initial
  refreshLists().catch(() => {});
});
