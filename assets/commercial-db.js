// /assets/commercial-db.js
// Commercial Firestore org-layer DB helpers
// NO PILOT DATA. NO KPI MATH.
// Enterprise-only structure.
// ✅ Store active/inactive support added
// ✅ Archive helper added
// ✅ Active-store list helper added

import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================================================
   Helpers
========================================================= */

function nowIso() {
  return new Date().toISOString();
}

function normalizeIds(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map(x => x.trim()).filter(Boolean);
  return [];
}

function cleanString(v) {
  return String(v || "").trim();
}

function safeRowsArray(v) {
  return Array.isArray(v) ? v : [];
}

function makeWeekId(weekStart) {
  const ws = cleanString(weekStart);
  if (!ws) throw new Error("Week start is required.");
  return ws;
}

/* =========================================================
   ORGS
========================================================= */

export async function createOrg({ name, createdByUid, createdByEmail }) {
  const orgName = String(name || "").trim();
  if (!orgName) throw new Error("Org name required.");
  if (!createdByUid) throw new Error("Missing creator UID.");

  const orgRef = await addDoc(collection(db, "orgs"), {
    name: orgName,
    createdAt: serverTimestamp(),
    createdAtIso: nowIso(),
    createdByUid: String(createdByUid || "").trim(),
    createdByEmail: String(createdByEmail || "").trim(),
    active: true
  });

  return orgRef.id;
}

export async function listOrgs() {
  const snap = await getDocs(
    query(collection(db, "orgs"), orderBy("createdAt", "desc"), limit(100))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================================================
   STORES (org subcollection)
========================================================= */

export async function createStore({ orgId, name, regionId, districtId, active = true }) {
  const oid = String(orgId || "").trim();
  const storeName = String(name || "").trim();

  if (!oid) throw new Error("Org ID required.");
  if (!storeName) throw new Error("Store name required.");

  const storeRef = await addDoc(collection(db, "orgs", oid, "stores"), {
    name: storeName,
    regionId: String(regionId || "").trim() || null,
    districtId: String(districtId || "").trim() || null,
    baselineApproved: false,
    baselineLocked: false,
    activeBaselineId: null,
    activeBaselineLabel: null,
    latestWeekId: null,
    latestWeekStart: null,
    latestWeekApproved: false,
    active: !!active,
    archived: false,
    archivedAt: null,
    archivedAtIso: null,
    archivedByUid: null,
    archivedByEmail: null,
    createdAt: serverTimestamp(),
    createdAtIso: nowIso()
  });

  return storeRef.id;
}

export async function listStores(orgId) {
  const oid = String(orgId || "").trim();
  if (!oid) throw new Error("Org ID required.");

  const snap = await getDocs(
    query(collection(db, "orgs", oid, "stores"), orderBy("createdAt", "desc"), limit(200))
  );

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listActiveStores(orgId) {
  const stores = await listStores(orgId);
  return (stores || []).filter(s => s.active !== false && s.archived !== true);
}

export async function setStoreActiveStatus({
  orgId,
  storeId,
  active,
  updatedByUid,
  updatedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (typeof active !== "boolean") throw new Error("Active status must be true or false.");

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    active: !!active,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso(),
    updatedByUid: cleanString(updatedByUid) || null,
    updatedByEmail: cleanString(updatedByEmail) || null
  }, { merge: true });

  return true;
}

export async function archiveStore({
  orgId,
  storeId,
  archivedByUid,
  archivedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    active: false,
    archived: true,
    archivedAt: serverTimestamp(),
    archivedAtIso: nowIso(),
    archivedByUid: cleanString(archivedByUid) || null,
    archivedByEmail: cleanString(archivedByEmail) || null
  }, { merge: true });

  return true;
}

/* =========================================================
   BASELINE GOVERNANCE
   One approved active baseline per store
   Baseline may represent a month, but weekly KPI comparison
   should later use normalized weekly equivalent in KPI layer.
========================================================= */

export async function savePendingStoreBaseline({
  orgId,
  storeId,
  label,
  year,
  rows,
  uploadedByUid,
  uploadedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const baselineLabel = cleanString(label) || cleanString(year) || "baseline";
  const safeRows = safeRowsArray(rows);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!safeRows.length) throw new Error("Baseline rows required.");

  const baselineId = "pending_baseline";

  await setDoc(doc(db, "orgs", oid, "stores", sid, "baselines", baselineId), {
    label: baselineLabel,
    year: cleanString(year) || null,
    rows: safeRows,
    rowCount: safeRows.length,
    approved: false,
    active: false,
    locked: false,
    replaced: false,
    uploadedByUid: cleanString(uploadedByUid) || null,
    uploadedByEmail: cleanString(uploadedByEmail) || null,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    baselineApproved: false,
    baselineLocked: false
  }, { merge: true });

  return baselineId;
}

export async function getStoreBaselineStatus(orgId, storeId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const storeSnap = await getDoc(doc(db, "orgs", oid, "stores", sid));
  const pendingSnap = await getDoc(doc(db, "orgs", oid, "stores", sid, "baselines", "pending_baseline"));

  const store = storeSnap.exists() ? (storeSnap.data() || {}) : {};
  const pendingRaw = pendingSnap.exists() ? (pendingSnap.data() || {}) : null;

  let active = null;
  const activeBaselineId = cleanString(store.activeBaselineId);
  if (activeBaselineId) {
    const activeSnap = await getDoc(doc(db, "orgs", oid, "stores", sid, "baselines", activeBaselineId));
    if (activeSnap.exists()) active = { id: activeSnap.id, ...(activeSnap.data() || {}) };
  }

  const pending =
    pendingRaw && !pendingRaw.replaced
      ? { id: "pending_baseline", ...pendingRaw }
      : null;

  return {
    storeId: sid,
    baselineApproved: !!store.baselineApproved,
    baselineLocked: !!store.baselineLocked,
    activeBaselineId: activeBaselineId || null,
    activeBaselineLabel: store.activeBaselineLabel || null,
    pendingBaseline: pending,
    activeBaseline: active,
    storeActive: store.active !== false,
    storeArchived: store.archived === true
  };
}

export async function approvePendingStoreBaseline({
  orgId,
  storeId,
  approvedByUid,
  approvedByEmail
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const pendingRef = doc(db, "orgs", oid, "stores", sid, "baselines", "pending_baseline");
  const pendingSnap = await getDoc(pendingRef);

  if (!pendingSnap.exists()) {
    throw new Error("No pending baseline found for this store.");
  }

  const pending = pendingSnap.data() || {};
  if (pending.replaced) {
    throw new Error("Pending baseline has already been replaced.");
  }

  const approvedId = `approved_${Date.now()}`;
  const approvedRef = doc(db, "orgs", oid, "stores", sid, "baselines", approvedId);

  await setDoc(approvedRef, {
    ...pending,
    approved: true,
    active: true,
    locked: true,
    replaced: false,
    approvedByUid: cleanString(approvedByUid) || null,
    approvedByEmail: cleanString(approvedByEmail) || null,
    approvedAt: serverTimestamp(),
    approvedAtIso: nowIso()
  }, { merge: true });

  await setDoc(pendingRef, {
    replaced: true,
    approved: false,
    active: false,
    locked: false,
    replacedAt: serverTimestamp(),
    replacedAtIso: nowIso()
  }, { merge: true });

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    baselineApproved: true,
    baselineLocked: true,
    activeBaselineId: approvedId,
    activeBaselineLabel: pending.label || pending.year || "approved baseline",
    baselineApprovedAt: serverTimestamp(),
    baselineApprovedAtIso: nowIso()
  }, { merge: true });

  return approvedId;
}

/* =========================================================
   WEEKLY UPLOADS
   Stores weekly data separately from baseline.
   Structure:
   /orgs/{orgId}/stores/{storeId}/weeks/{weekId}
========================================================= */

export async function saveStoreWeek({
  orgId,
  storeId,
  weekStart,
  rows,
  uploadedByUid,
  uploadedByEmail,
  note
}) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const ws = cleanString(weekStart);
  const weekId = makeWeekId(ws);
  const safeRows = safeRowsArray(rows);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!ws) throw new Error("Week start required.");
  if (!safeRows.length) throw new Error("Weekly rows required.");

  await setDoc(doc(db, "orgs", oid, "stores", sid, "weeks", weekId), {
    weekId,
    weekStart: ws,
    rows: safeRows,
    rowCount: safeRows.length,
    approved: true,
    active: true,
    note: cleanString(note) || null,
    uploadedByUid: cleanString(uploadedByUid) || null,
    uploadedByEmail: cleanString(uploadedByEmail) || null,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  await setDoc(doc(db, "orgs", oid, "stores", sid), {
    latestWeekId: weekId,
    latestWeekStart: ws,
    latestWeekApproved: true,
    latestWeekAtIso: nowIso()
  }, { merge: true });

  return weekId;
}

export async function getStoreWeek(orgId, storeId, weekId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);
  const wid = cleanString(weekId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");
  if (!wid) throw new Error("Week ID required.");

  const snap = await getDoc(doc(db, "orgs", oid, "stores", sid, "weeks", wid));
  if (!snap.exists()) return null;

  return { id: snap.id, ...(snap.data() || {}) };
}

export async function listStoreWeeks(orgId, storeId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const snap = await getDocs(
    query(
      collection(db, "orgs", oid, "stores", sid, "weeks"),
      orderBy("weekStart", "desc"),
      limit(104)
    )
  );

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLatestStoreWeek(orgId, storeId) {
  const weeks = await listStoreWeeks(orgId, storeId);
  return weeks.length ? weeks[0] : null;
}

export async function getStoreWeekStatus(orgId, storeId) {
  const oid = cleanString(orgId);
  const sid = cleanString(storeId);

  if (!oid) throw new Error("Org ID required.");
  if (!sid) throw new Error("Store ID required.");

  const latestWeek = await getLatestStoreWeek(oid, sid);

  return {
    storeId: sid,
    latestWeek: latestWeek || null,
    hasWeeks: !!latestWeek
  };
}

/* =========================================================
   USER ACCESS
   Writes to:
   1) /commercial_users/{uid}
   2) /orgs/{orgId}/users/{uid}
========================================================= */

export async function upsertUserAccess({
  uid,
  email,
  orgId,
  role,
  commercialAccess,
  active,
  assignedStoreIds,
  assignedDistrictIds,
  assignedRegionIds,
  isSuperAdmin
}) {
  const _uid = String(uid || "").trim();
  const _email = String(email || "").trim().toLowerCase();
  const _orgId = String(orgId || "").trim();

  if (!_uid) throw new Error("UID required.");
  if (!_email) throw new Error("Email required.");

  await setDoc(doc(db, "commercial_users", _uid), {
    uid: _uid,
    email: _email,
    orgId: _orgId || null,
    role: String(role || "SM").trim().toUpperCase(),
    commercialAccess: !!commercialAccess,
    isSuperAdmin: !!isSuperAdmin,
    active: !!active,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso()
  }, { merge: true });

  if (_orgId) {
    await setDoc(doc(db, "orgs", _orgId, "users", _uid), {
      uid: _uid,
      email: _email,
      role: String(role || "SM").trim().toUpperCase(),
      commercialAccess: !!commercialAccess,
      isSuperAdmin: !!isSuperAdmin,
      assignedStoreIds: normalizeIds(assignedStoreIds),
      assignedDistrictIds: normalizeIds(assignedDistrictIds),
      assignedRegionIds: normalizeIds(assignedRegionIds),
      active: !!active,
      updatedAt: serverTimestamp(),
      updatedAtIso: nowIso()
    }, { merge: true });
  }

  return true;
}