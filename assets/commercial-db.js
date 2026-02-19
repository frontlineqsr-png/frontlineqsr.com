// assets/commercial-db.js (v1.0)
// Commercial Firestore org-layer DB helpers
// ✅ NO PILOT DATA. NO KPI MATH.
// Firestore structure:
// /orgs/{orgId}
// /orgs/{orgId}/stores/{storeId}
// /orgs/{orgId}/users/{uid}
// /commercial_users/{uid}

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
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ----------------------------------
// Helpers
// ----------------------------------
function cleanId(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

// ----------------------------------
// ORGS
// ----------------------------------
export async function createOrg({ name, createdByUid, createdByEmail }) {
  const orgName = String(name || "").trim();
  if (!orgName) throw new Error("Org name required.");

  const orgRef = await addDoc(collection(db, "orgs"), {
    name: orgName,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: String(createdByUid || "").trim(),
    createdByEmail: String(createdByEmail || "").trim(),
    createdAtIso: nowIso(),
  });

  return orgRef.id;
}

export async function listOrgs() {
  const qy = query(collection(db, "orgs"), orderBy("createdAtIso", "desc"), limit(50));
  const snap = await getDocs(qy);

  return snap.docs.map(d => {
    const data = d.data() || {};
    return {
      id: d.id,
      name: data.name || "",
      active: !!data.active,
      createdAtIso: data.createdAtIso || "",
      createdBy: data.createdBy || "",
      createdByEmail: data.createdByEmail || "",
    };
  });
}

// ----------------------------------
// STORES
// ----------------------------------
export async function createStore({ orgId, name, regionId, districtId }) {
  const oid = String(orgId || "").trim();
  if (!oid) throw new Error("orgId required.");

  const storeName = String(name || "").trim();
  if (!storeName) throw new Error("Store name required.");

  // Use addDoc so storeId is generated (safe + easy)
  const storeRef = await addDoc(collection(db, "orgs", oid, "stores"), {
    name: storeName,
    regionId: String(regionId || "").trim() || null,
    districtId: String(districtId || "").trim() || null,

    baselineApproved: false,
    baselineLocked: false,
    active: true,

    createdAt: serverTimestamp(),
    createdAtIso: nowIso(),
  });

  return storeRef.id;
}

export async function listStores(orgId) {
  const oid = String(orgId || "").trim();
  if (!oid) throw new Error("orgId required.");

  const qy = query(collection(db, "orgs", oid, "stores"), orderBy("createdAtIso", "desc"), limit(200));
  const snap = await getDocs(qy);

  return snap.docs.map(d => {
    const data = d.data() || {};
    return {
      id: d.id,
      name: data.name || "",
      active: !!data.active,
      regionId: data.regionId || "",
      districtId: data.districtId || "",
      baselineApproved: !!data.baselineApproved,
      baselineLocked: !!data.baselineLocked,
    };
  });
}

// ----------------------------------
// USERS (Directory + Org-layer user doc)
// ----------------------------------
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
  const _role = String(role || "SM").trim().toUpperCase();

  if (!_uid) throw new Error("uid required.");
  if (!_email) throw new Error("email required.");

  const dirRef = doc(db, "commercial_users", _uid);

  // 1) Write directory (global routing profile)
  await setDoc(
    dirRef,
    {
      uid: _uid,
      email: _email,
      orgId: _orgId || "",
      role: _role,
      commercialAccess: !!commercialAccess,
      active: !!active,
      isSuperAdmin: !!isSuperAdmin,

      updatedAt: serverTimestamp(),
      updatedAtIso: nowIso(),
    },
    { merge: true }
  );

  // 2) Write org-layer user doc (authoritative within org)
  // Only if orgId is present OR super admin (super admin can be org-less)
  if (_orgId) {
    const orgUserRef = doc(db, "orgs", _orgId, "users", _uid);

    await setDoc(
      orgUserRef,
      {
        uid: _uid,
        email: _email,
        role: _role,

        assignedStoreIds: Array.isArray(assignedStoreIds) ? assignedStoreIds : [],
        assignedDistrictIds: Array.isArray(assignedDistrictIds) ? assignedDistrictIds : [],
        assignedRegionIds: Array.isArray(assignedRegionIds) ? assignedRegionIds : [],

        active: !!active,

        updatedAt: serverTimestamp(),
        updatedAtIso: nowIso(),
      },
      { merge: true }
    );
  }

  return true;
}

// Optional utility if you ever want to validate a directory profile exists
export async function getCommercialDirectory(uid) {
  const _uid = String(uid || "").trim();
  if (!_uid) throw new Error("uid required.");

  const snap = await getDoc(doc(db, "commercial_users", _uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() || {}) };
}
