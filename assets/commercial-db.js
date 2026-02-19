// /assets/commercial-db.js
// Commercial Firestore org-layer DB helpers
// NO PILOT DATA. NO KPI MATH.
// Enterprise-only structure.

import { db } from "./firebase.js";
import {
  collection,
  doc,
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
