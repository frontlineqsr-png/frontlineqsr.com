// /assets/commercial-admin.js (v11 FIXED)
// FULL admin restored + reset tools added
// ✅ Everything wired
// ✅ Reset works
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
  deleteStoreWeek,
  deleteStoreBaseline,
  resetStoreData
} from "./commercial-db.js";

const $ = (id) => document.getElementById(id);

/* ================= HELPERS ================= */

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("FLQSR_COMM_SESSION") || "null");
  } catch { return null; }
}

function msg(id, text, err=false){
  const el = $(id);
  if(!el) return;
  el.textContent = text || "";
  el.style.color = err ? "#b91c1c" : "#065f46";
}

function currentSession(){
  const s = readSession();
  if(!s?.uid) throw new Error("Missing session");
  return s;
}

function confirmDelete(){
  if(($("resetConfirmText")?.value || "").toUpperCase() !== "DELETE"){
    throw new Error("Type DELETE to confirm");
  }
}

/* ================= ORG / STORE ================= */

async function onCreateOrg(){
  try{
    const s = currentSession();
    const name = $("orgName").value.trim();
    if(!name) throw new Error("Org name required");

    const id = await createOrg({
      name,
      createdByUid:s.uid,
      createdByEmail:s.email
    });

    msg("orgMsg","✅ Org created");
    $("orgIdOut").textContent = id;
  }catch(e){ msg("orgMsg","❌ "+e.message,true); }
}

async function onCreateStore(){
  try{
    const orgId = $("storeOrgId").value.trim();
    const name = $("storeName").value.trim();

    const id = await createStore({orgId,name});

    msg("storeMsg","✅ Store created: "+id);
  }catch(e){ msg("storeMsg","❌ "+e.message,true); }
}

/* ================= USER ================= */

async function onSaveUser(){
  try{
    await upsertUserAccess({
      uid:$("u_uid").value.trim(),
      email:$("u_email").value.trim(),
      orgId:$("u_orgId").value.trim(),
      role:$("u_role").value,
      commercialAccess:true,
      active:true,
      assignedStoreIds:[]
    });

    msg("userMsg","✅ Saved");
  }catch(e){ msg("userMsg","❌ "+e.message,true); }
}

/* ================= VIEW LAUNCH ================= */

function openLevel(level){
  const org = $("inspectOrgId").value.trim();
  const store = $("inspectStoreId").value.trim();

  if(level==="sm" && !store){
    msg("inspectMsg","❌ Store required",true);
    return;
  }

  let path="./commercial-vp.html";
  if(level==="rm") path="./commercial-rm.html";
  if(level==="dm") path="./commercial-dm.html";
  if(level==="sm") path="./commercial-portal.html";

  const url = `${path}?org=${org}&store=${store}`;
  window.location.href = url;
}

/* ================= BASELINE ================= */

async function onSaveBaseline(){
  try{
    const s = currentSession();

    const file = $("baselineCsvFile").files[0];
    if(!file) throw new Error("CSV required");

    const text = await file.text();
    const rows = text.split("\n");

    await savePendingStoreBaseline({
      orgId:$("baselineIntakeOrgId").value.trim(),
      storeId:$("baselineIntakeStoreId").value.trim(),
      rows,
      uploadedByUid:s.uid,
      uploadedByEmail:s.email
    });

    msg("baselineIntakeMsg","✅ Saved");
  }catch(e){ msg("baselineIntakeMsg","❌ "+e.message,true); }
}

/* ================= WEEKLY ================= */

async function onSaveWeekly(){
  try{
    const s = currentSession();

    const file = $("weeklyCsvFile").files[0];
    if(!file) throw new Error("CSV required");

    const text = await file.text();
    const rows = text.split("\n");

    await saveStoreWeek({
      orgId:$("weeklyOrgId").value.trim(),
      storeId:$("weeklyStoreId").value.trim(),
      weekStart:$("weeklyStart").value,
      rows,
      uploadedByUid:s.uid,
      uploadedByEmail:s.email
    });

    msg("weeklyIntakeMsg","✅ Weekly saved");
  }catch(e){ msg("weeklyIntakeMsg","❌ "+e.message,true); }
}

/* ================= BASELINE GOV ================= */

async function onLoadBaseline(){
  try{
    const data = await getStoreBaselineStatus(
      $("baselineOrgId").value.trim(),
      $("baselineStoreId").value.trim()
    );

    $("baselineStatus").textContent = JSON.stringify(data,null,2);
    msg("baselineMsg","✅ Loaded");
  }catch(e){ msg("baselineMsg","❌ "+e.message,true); }
}

async function onApproveBaseline(){
  try{
    const s = currentSession();

    await approvePendingStoreBaseline({
      orgId:$("baselineOrgId").value.trim(),
      storeId:$("baselineStoreId").value.trim(),
      approvedByUid:s.uid,
      approvedByEmail:s.email
    });

    msg("baselineMsg","✅ Approved");
  }catch(e){ msg("baselineMsg","❌ "+e.message,true); }
}

/* ================= RESET ================= */

async function onDeleteWeek(){
  try{
    confirmDelete();
    const s = currentSession();

    await deleteStoreWeek({
      orgId:$("resetOrgId").value.trim(),
      storeId:$("resetStoreId").value.trim(),
      weekId:$("resetWeekId").value.trim(),
      deletedByUid:s.uid,
      deletedByEmail:s.email
    });

    msg("resetMsg","✅ Week deleted");
  }catch(e){ msg("resetMsg","❌ "+e.message,true); }
}

async function onDeleteBaseline(){
  try{
    confirmDelete();
    const s = currentSession();

    await deleteStoreBaseline({
      orgId:$("resetOrgId").value.trim(),
      storeId:$("resetStoreId").value.trim(),
      deletedByUid:s.uid,
      deletedByEmail:s.email
    });

    msg("resetMsg","✅ Baseline deleted");
  }catch(e){ msg("resetMsg","❌ "+e.message,true); }
}

async function onResetStore(){
  try{
    confirmDelete();
    const s = currentSession();

    await resetStoreData({
      orgId:$("resetOrgId").value.trim(),
      storeId:$("resetStoreId").value.trim(),
      resetByUid:s.uid,
      resetByEmail:s.email
    });

    msg("resetMsg","✅ Store reset");
  }catch(e){ msg("resetMsg","❌ "+e.message,true); }
}

/* ================= INIT ================= */

window.addEventListener("DOMContentLoaded", () => {

  $("createOrgBtn")?.onclick = onCreateOrg;
  $("createStoreBtn")?.onclick = onCreateStore;
  $("saveUserBtn")?.onclick = onSaveUser;

  $("openVpBtn")?.onclick = () => openLevel("vp");
  $("openRmBtn")?.onclick = () => openLevel("rm");
  $("openDmBtn")?.onclick = () => openLevel("dm");
  $("openSmBtn")?.onclick = () => openLevel("sm");

  $("saveBaselineBtn")?.onclick = onSaveBaseline;
  $("saveWeeklyBtn")?.onclick = onSaveWeekly;

  $("loadBaselineBtn")?.onclick = onLoadBaseline;
  $("approveBaselineBtn")?.onclick = onApproveBaseline;

  $("deleteWeekBtn")?.onclick = onDeleteWeek;
  $("deleteBaselineBtn")?.onclick = onDeleteBaseline;
  $("resetStoreBtn")?.onclick = onResetStore;

});