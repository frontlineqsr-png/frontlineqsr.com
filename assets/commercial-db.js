// /assets/commercial-db.js
// Commercial Firestore org-layer DB helpers
// NO PILOT DATA. NO KPI MATH.
// Enterprise-only structure.

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

export async function createStore({ orgId, name, regionId, districtId }) {
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
    active: true,
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

/* =========================================================
   BASELINE GOVERNANCE
   One approved active baseline per store
   Baseline may represent a month, but weekly KPI comparison
   should later use normalized weekly equivalent in KPI layer.
========================================================= */

// Save or replace pending baseline for a store.
// rows should stay in same row/object format as pilot CSV parsing.
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
  const safeRows = Array.isArray(rows) ? rows : [];

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
    activeBaseline: active
  };
}

// Approves pending baseline and makes it the single active baseline for the store.
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

  // create immutable approved version
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

  // mark pending baseline as replaced / inactive
  await setDoc(pendingRef, {
    replaced: true,
    approved: false,
    active: false,
    locked: false,
    replacedAt: serverTimestamp(),
    replacedAtIso: nowIso()
  }, { merge: true });

  // update store-level truth fields
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

  // 1) Global directory
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

  // 2) Org subcollection (skip if no orgId)
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