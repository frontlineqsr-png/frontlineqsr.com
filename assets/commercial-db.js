// /assets/commercial-db.js
// Commercial Firestore org-layer CRUD (NO PILOT DATA)
// Uses: ./firebase.js exports { db }

import { db } from "./firebase.js";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function nowISO() { return new Date().toISOString(); }
function cleanId(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createOrg({ name, createdByUid, createdByEmail }) {
  const orgId = "org_" + cleanId(name) + "_" + Date.now();
  const ref = doc(db, "orgs", orgId);

  await setDoc(ref, {
    name: String(name || "").trim(),
    createdAt: serverTimestamp(),
    createdAtIso: nowISO(),
    createdBy: String(createdByUid || "").trim(),
    createdByEmail: String(createdByEmail || "").trim(),
    active: true,
  });

  return orgId;
}

export async function createStore({ orgId, name, regionId = "", districtId = "" }) {
  if (!orgId) throw new Error("Missing orgId");
  const storeId = "store_" + cleanId(name) + "_" + Date.now();
  const ref = doc(db, "orgs", orgId, "stores", storeId);

  await setDoc(ref, {
    name: String(name || "").trim(),
    regionId: String(regionId || "").trim(),
    districtId: String(districtId || "").trim(),
    baselineApproved: false,
    baselineLocked: false,
    active: true,
    createdAt: serverTimestamp(),
    createdAtIso: nowISO(),
  });

  return storeId;
}

// Writes BOTH:
// - commercial_users/{uid} directory
// - orgs/{orgId}/users/{uid} org-user profile
export async function upsertUserAccess({
  uid,
  email,
  orgId,
  role,                 // "SM" | "DM" | "RM" | "VP" | "OWNER" | "SUPER_ADMIN"
  commercialAccess,     // boolean
  active = true,
  assignedStoreIds = [],
  assignedDistrictIds = [],
  assignedRegionIds = [],
  isSuperAdmin = false,
}) {
  const U = String(uid || "").trim();
  if (!U) throw new Error("Missing uid (Firebase Auth UID required).");

  const E = String(email || "").trim().toLowerCase();
  const O = String(orgId || "").trim();

  const R = String(role || "SM").trim().toUpperCase();

  // directory
  await setDoc(doc(db, "commercial_users", U), {
    uid: U,
    email: E,
    orgId: O,
    role: R,
    commercialAccess: !!commercialAccess,
    isSuperAdmin: !!isSuperAdmin,
    active: !!active,
    updatedAt: serverTimestamp(),
    updatedAtIso: nowISO(),
  }, { merge: true });

  // org user (skip org write if SUPER_ADMIN with no orgId yet)
  if (O) {
    await setDoc(doc(db, "orgs", O, "users", U), {
      role: R,
      assignedStoreIds: Array.isArray(assignedStoreIds) ? assignedStoreIds : [],
      assignedDistrictIds: Array.isArray(assignedDistrictIds) ? assignedDistrictIds : [],
      assignedRegionIds: Array.isArray(assignedRegionIds) ? assignedRegionIds : [],
      active: !!active,
      updatedAt: serverTimestamp(),
      updatedAtIso: nowISO(),
    }, { merge: true });
  }

  return { uid: U, email: E, orgId: O, role: R };
}

export async function listOrgs() {
  const snap = await getDocs(query(collection(db, "orgs"), orderBy("createdAtIso", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listStores(orgId) {
  if (!orgId) return [];
  const snap = await getDocs(query(collection(db, "orgs", orgId, "stores"), orderBy("createdAtIso", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listOrgUsers(orgId) {
  if (!orgId) return [];
  const snap = await getDocs(collection(db, "orgs", orgId, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDirectory(uid) {
  const s = await getDoc(doc(db, "commercial_users", String(uid || "").trim()));
  return s.exists() ? s.data() : null;
}

