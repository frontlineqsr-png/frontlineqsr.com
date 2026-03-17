// /assets/commercial-admin.js (v3)
// Commercial admin workspace logic
// Shared auth/session/logout is handled by commercial-page-boot.js
// NO PILOT DATA. NO KPI MATH.

import {
  createOrg,
  createStore,
  upsertUserAccess,
  listOrgs,
  listStores
} from "./commercial-db.js";

const $ = (id) => document.getElementById(id);

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

function currentSession() {
  const s = readSession();
  if (!s?.uid) throw new Error("Missing commercial session.");
  return s;
}

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
    if ($("storeOrgId")) $("storeOrgId").value = orgId;
    if ($("u_orgId")) $("u_orgId").value = orgId;
    if ($("listOrgId")) $("listOrgId").value = orgId;
    if ($("inspectOrgId")) $("inspectOrgId").value = orgId;
  } catch (e) {
    console.error(e);
    msg("orgMsg", "❌ " + (e?.message || "Failed"), true);
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

    if ($("inspectOrgId")) $("inspectOrgId").value = orgId;
    if ($("inspectRegionId") && regionId) $("inspectRegionId").value = regionId;
    if ($("inspectDistrictId") && districtId) $("inspectDistrictId").value = districtId;
    if ($("inspectStoreId")) $("inspectStoreId").value = storeId;
  } catch (e) {
    console.error(e);
    msg("storeMsg", "❌ " + (e?.message || "Failed"), true);
  }
}

async function onSaveUser() {
  try {
    const uid = String($("u_uid")?.value || "").trim();
    const email = String($("u_email")?.value || "").trim().toLowerCase();
    const orgId = String($("u_orgId")?.value || "").trim();
    const role = String($("u_role")?.value || "SM").trim().toUpperCase();
    const commercialAccess = !!$("u_commercial")?.checked;
    const active = !!$("u_active")?.checked;
    const assignedStoreIds = parseCsvIds($("u_storeIds")?.value || "");

    if (!uid) throw new Error("User UID required.");
    if (!email) throw new Error("Email required.");
    if (!orgId && role !== "SUPER_ADMIN") {
      throw new Error("Org Id required for non-super-admin.");
    }

    msg("userMsg", "Saving user access…");

    const isSuperAdmin = role === "SUPER_ADMIN";

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

    msg("userMsg", "✅ User access saved (commercial_users + org user profile).");
  } catch (e) {
    console.error(e);
    msg("userMsg", "❌ " + (e?.message || "Failed"), true);
  }
}

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

    if (level === "rm" && !$("inspectRegionId")?.value.trim()) {
      msg("inspectMsg", "❌ Region Id is recommended for Region View.", true);
      return;
    }

    if (level === "dm" && !$("inspectDistrictId")?.value.trim()) {
      msg("inspectMsg", "❌ District Id is recommended for District View.", true);
      return;
    }

    if (level === "sm" && !$("inspectStoreId")?.value.trim()) {
      msg("inspectMsg", "❌ Store Id is required for Store View.", true);
      return;
    }

    msg("inspectMsg", `Opening ${level.toUpperCase()} view…`);
    window.location.href = url;
  } catch (e) {
    console.error(e);
    msg("inspectMsg", "❌ " + (e?.message || "Failed to open view"), true);
  }
}

async function refreshLists() {
  try {
    msg("globalMsg", "Refreshing…");

    const orgs = await listOrgs();
    if ($("orgList")) {
      $("orgList").textContent =
        orgs.map(o => `${o.id}  |  ${o.name}  |  active=${!!o.active}`).join("\n") || "(none)";
    }

    const orgId = String($("listOrgId")?.value || "").trim();
    if (orgId) {
      const stores = await listStores(orgId);
      if ($("storeList")) {
        $("storeList").textContent =
          stores.map(st => `${st.id}  |  ${st.name}  |  baselineLocked=${!!st.baselineLocked}`).join("\n") || "(none)";
      }
    } else {
      if ($("storeList")) $("storeList").textContent = "(enter orgId to list stores)";
    }

    msg("globalMsg", "✅ Refreshed.");
  } catch (e) {
    console.error(e);
    msg("globalMsg", "❌ " + (e?.message || "Failed"), true);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  setAdminHeaderContext();

  $("createOrgBtn")?.addEventListener("click", onCreateOrg);
  $("createStoreBtn")?.addEventListener("click", onCreateStore);
  $("saveUserBtn")?.addEventListener("click", onSaveUser);
  $("refreshBtn")?.addEventListener("click", refreshLists);

  $("openVpBtn")?.addEventListener("click", () => openLevel("vp"));
  $("openRmBtn")?.addEventListener("click", () => openLevel("rm"));
  $("openDmBtn")?.addEventListener("click", () => openLevel("dm"));
  $("openSmBtn")?.addEventListener("click", () => openLevel("sm"));

  refreshLists().catch(() => {});
});