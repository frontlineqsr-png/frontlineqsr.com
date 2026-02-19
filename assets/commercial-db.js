// /assets/commercial-db.js
// Commercial Firestore org-layer DB helpers
// NO PILOT DATA. NO KPI MATH.
// Uses Firestore: orgs/{orgId} + org subcollections + commercial_users/{uid}

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

function cleanId(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

// -----------------------------
// ORGS
// -----------------------------
export async function createOrg({ name, createdByUid, createdByEmail }) {
  const n = String(name || "").trim();
  if (!n) throw new Error("Org name required.");

  // Create org doc id via addDoc → grab id → set explicit fields
  const orgRef = await addDoc(collection(db, "orgs"), {
    name: n,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: {
      uid: String(createdByUid || "").trim(),
      email: String(createdByEmail || "").trim().toLowerCase(),
    },
    createdAtIso: nowIso(),
  });

  return orgRef.id;
}

export async function listOrgs() {
  const qy = query(collection(db, "orgs"), orderBy("createdAtIso", "desc"), limit(50));
  const snap = await getDocs(qy);
  const out = [];
  snap.forEach(d => {
    const data = d.data() || {};
    out.push({
      id: d.id,
      name: data.name || "(no name)",
      active: !!data.active,
      createdAtIso: data.createdAtIso || "",
    });
  });
  return out;
}

// -----------------------------
// STORES
// -----------------------------
export async function createStore({ orgId, name, regionId = "", districtId = "" }) {
  const oid = String(orgId || "").trim();
  const n = String(name || "").trim();
  if (!oid) throw new Error("orgId required.");
  if (!n) throw new Error("Store name required.");

  // storeId is deterministic from name + timestamp (safe + readable)
  const storeId = cleanId(n) + "_" + Date.now();

  const ref = doc(db, "orgs", oid, "stores", storeId);
  await setDoc(ref, {
    name: n,
    regionId: String(regionId || "").trim(),
    districtId: String(districtId || "").trim(),
    baselineApproved: false,
    baselineLocked: false,
    active: true,
    createdAt: serverTimestamp(),
    createdAtIso: nowIso(),
  });

  return storeId;
}

export async function listStores(orgId) {
  const oid = String(orgId || "").trim();
  if (!oid) throw new Error("orgId required.");
  const qy = query(collection(db, "orgs", oid, "stores"), orderBy("createdAtIso", "desc"), limit(100));
  const snap = await getDocs(qy);
  const out = [];
  snap.forEach(d => {
    const data = d.data() || {};
    out.push({
      id: d.id,
      name: data.name || "(no name)",
      baselineLocked: !!data.baselineLocked,
      baselineApproved: !!data.baselineApproved,
      active: !!data.active,
    });
  });
  return out;
}

// -----------------------------
// USERS: DIRECTORY + ORG USER DOC
// -----------------------------
export async function upsertUserAccess({
  uid,
  email,
  orgId,
  role,
  commercialAccess,
  active,
  assignedStoreIds = [],
  assignedDistrictIds = [],
  assignedRegionIds = [],
  isSuperAdmin = false
}) {
  const u = String(uid || "").trim();
  const e = String(email || "").trim().toLowerCase();
  const oid = String(orgId || "").trim();
  const r = String(role || "SM").trim().toUpperCase();

  if (!u) throw new Error("uid required.");
  if (!e) throw new Error("email required.");

  // 1) commercial_users directory doc (for login routing)
  await setDoc(doc(db, "commercial_users", u), {
    uid: u,
    email: e,
    orgId: oid,
    role: r,
    commercialAccess: !!commercialAccess,
    active: !!active,
    isSuperAdmin: !!isSuperAdmin,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowIso(),
  }, { merge: true });

  // 2) org-layer user doc (authoritative for scopes inside org)
  // Only write org doc if orgId exists (super admins can have no org)
  if (oid) {
    await setDoc(doc(db, "orgs", oid, "users", u), {
      uid: u,
      email: e,
      role: r,
      assignedStoreIds: Array.isArray(assignedStoreIds) ? assignedStoreIds : [],
      assignedDistrictIds: Array.isArray(assignedDistrictIds) ? assignedDistrictIds : [],
      assignedRegionIds: Array.isArray(assignedRegionIds) ? assignedRegionIds : [],
      active: !!active,
      updatedAt: serverTimestamp(),
      updatedAtIso: nowIso(),
    }, { merge: true });
  }

  return true;
}
