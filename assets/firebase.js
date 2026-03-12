// /assets/firebase.js
// Single source of truth for Firebase config (Auth + Firestore)
// + Auto-provision flqsr_users profile on first login

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANTxxbSP4UMmEmrOKH8wn2UhR2GUmWiYc",
  authDomain: "frontlineqsr-prod.firebaseapp.com",
  projectId: "frontlineqsr-prod",
  storageBucket: "frontlineqsr-prod.firebasestorage.app",
  messagingSenderId: "114632679759",
  appId: "1:114632679759:web:6e207548b5a29fcecaa53a",
  measurementId: "G-8KFEXHE1TR"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* =========================================
   AUTO PROVISION flqsr_users PROFILE
========================================= */

async function ensurePilotUserProfile(user) {
  if (!user) return;

  const ref = doc(db, "flqsr_users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return; // already provisioned

  console.log("Auto-provisioning flqsr_users profile...");

  const emailLower = (user.email || "").toLowerCase();

  await setDoc(ref, {
    email: emailLower,           // 🔥 add this
    email_lower: emailLower,     // keep this
    role: "client",              
    company_id: "unassigned",    
    assigned_store_ids: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/* =========================================
   AUTH LISTENER
========================================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    await ensurePilotUserProfile(user);
  } catch (err) {
    console.error("Provisioning error:", err);
  }
});