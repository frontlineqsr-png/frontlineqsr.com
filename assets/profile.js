// assets/profile.js
// Firestore user profiles (roles + store assignments)
// Collection: flqsr_users (doc id = uid)

import { app } from "./firebase.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const db = getFirestore(app);

// Optional: super admin by email list (always overrides)
const SUPER_ADMIN_EMAILS = [
  "nrobinson@flqsr.com",
  "robinson8605@gmail.com",
];

export function isSuperAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.map(x => x.toLowerCase()).includes(e);
}

export async function fetchUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "flqsr_users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function upsertUserProfile(profile) {
  const uid = String(profile?.uid || "").trim();
  if (!uid) throw new Error("upsertUserProfile: missing uid");

  const payload = {
    uid,
    email: String(profile?.email || "").trim(),
    role: String(profile?.role || "client").trim(),
    company_id: String(profile?.company_id || "").trim(),
    assigned_store_ids: Array.isArray(profile?.assigned_store_ids)
      ? profile.assigned_store_ids.map(x => String(x).trim()).filter(Boolean)
      : [],
    updated_at: serverTimestamp(),
  };

  // Only set created_at on first write (safe merge)
  await setDoc(doc(db, "flqsr_users", uid), {
    ...payload,
    created_at: serverTimestamp(),
  }, { merge: true });

  return payload;
}
