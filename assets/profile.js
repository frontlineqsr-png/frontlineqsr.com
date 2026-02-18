// /assets/profile.js
// FrontlineQSR user profile helpers (Firestore)
// - Used by commercial-auth.js + admin tooling
// - Provides role/store access + super admin override
// - NO KPI math / NO governance changes

import { app } from "./firebase.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * Firestore collection that stores user profiles.
 * Document id = Firebase Auth uid
 *
 * Shape (recommended):
 * {
 *   uid: string,
 *   email: string,
 *   role: "client" | "admin" | "super_admin",
 *   company_id: string,
 *   assigned_store_ids: string[],
 *   updatedAt: serverTimestamp()
 * }
 */
const DB = getFirestore(app);
const COL = "flqsr_users";

/**
 * ✅ Super Admin allowlist
 * Put YOUR super admin email(s) here (lowercase).
 * You can add multiple.
 */
const SUPER_ADMIN_EMAILS = [
  // Example:
  // "nrobinson@flqsr.com",
];

/** Normalize email for comparison */
function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** Normalize role to allowed set */
function normRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "super_admin" || r === "superadmin" || r === "super-admin") return "super_admin";
  if (r === "admin") return "admin";
  return "client";
}

/** Normalize store id list */
function normStores(stores) {
  const arr = Array.isArray(stores) ? stores : [];
  return arr
    .map(s => String(s || "").trim())
    .filter(Boolean);
}

/**
 * True if email is a super admin email.
 */
export function isSuperAdminEmail(email) {
  const e = normEmail(email);
  if (!e) return false;
  return SUPER_ADMIN_EMAILS.includes(e);
}

/**
 * Returns a synthetic profile object for super admins.
 * This bypasses Firestore profile requirements.
 */
export function superAdminProfile(email) {
  const e = normEmail(email);
  return {
    uid: "super_admin",
    email: e,
    role: "super_admin",
    company_id: "",
    assigned_store_ids: [], // super admin should be treated as "all access" at gate level
    _source: "super_admin_override"
  };
}

/**
 * Fetch a user profile by uid from Firestore.
 * Returns null if missing.
 */
export async function fetchUserProfile(uid) {
  const id = String(uid || "").trim();
  if (!id) return null;

  try {
    const ref = doc(DB, COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() || {};
    return {
      uid: id,
      email: String(data.email || "").trim(),
      role: normRole(data.role),
      company_id: String(data.company_id || data.companyId || "").trim(),
      assigned_store_ids: normStores(data.assigned_store_ids || data.assignedStores || data.stores),
      _source: "firestore"
    };
  } catch (e) {
    console.error("[profile] fetchUserProfile failed:", e);
    return null;
  }
}

/**
 * Create/update a user profile record.
 * Used by Admin Review User Management (pilot-safe).
 */
export async function upsertUserProfile(profile) {
  const p = profile && typeof profile === "object" ? profile : {};
  const uid = String(p.uid || "").trim();
  const email = String(p.email || "").trim();

  if (!uid) throw new Error("upsertUserProfile: uid is required");
  if (!email) throw new Error("upsertUserProfile: email is required");

  const payload = {
    uid,
    email,
    role: normRole(p.role),
    company_id: String(p.company_id || "").trim(),
    assigned_store_ids: normStores(p.assigned_store_ids),
    updatedAt: serverTimestamp()
  };

  // Never allow writing super_admin through UI unless it is on the allowlist
  if (payload.role === "super_admin" && !isSuperAdminEmail(payload.email)) {
    payload.role = "admin";
  }

  const ref = doc(DB, COL, uid);
  await setDoc(ref, payload, { merge: true });
  return payload;
}