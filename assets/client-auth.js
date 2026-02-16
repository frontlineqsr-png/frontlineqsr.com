// /assets/client-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/** ✅ Use the SAME Firebase project as flqsr.com */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

const loginForm = $("loginForm");
const loginBtn = $("loginBtn");
const forgotBtn = $("forgotBtn");
const msg = $("msg");

function setMsg(text = "", type = "info") {
  msg.textContent = text;
  msg.className = `msg ${type}`;
}

function setBusy(isBusy) {
  loginBtn.disabled = isBusy;
  forgotBtn.disabled = isBusy;
}

function routeCommercialByRole(profile) {
  // You can adjust these routes to match your commercial pages.
  // Keep users on frontlineqsr.com (no redirects to flqsr.com).
  const role = (profile?.role || "").toLowerCase();

  // Everyone lands on KPIs first screen, but scoped by role.
  // Example pages:
  // - /app/kpis.html
  // - /app/progress.html
  // - /app/action-plan.html
  // - /app/org.html (only for VP/Owner/Regional/DM, if you enable it)

  // Minimal routing: all roles go to KPIs first.
  window.location.href = "/app/kpis.html";
}

/**
 * Expected Firestore user profile:
 * users/{uid} = {
 *   portal: "commercial" | "pilot",
 *   role: "store" | "dm" | "regional" | "owner" | "superadmin",
 *   companyId: "abc123",
 *   scope: { ... } // storeId/districtId/regionId/companyWide etc
 * }
 */
async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");
  setBusy(true);

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    const cred = await signInWithEmailAndPassword(auth, email, password);

    const profile = await getUserProfile(cred.user.uid);

    if (!profile) {
      // Profile missing = not provisioned properly
      throw new Error("Account is not fully provisioned. Please contact your company administrator.");
    }

    // ✅ Commercial access layer check
    if (profile.portal !== "commercial") {
      // Keep it clean and non-revealing (avoid telling them where they belong)
      throw new Error("This account does not have access to the client portal.");
    }

    routeCommercialByRole(profile);
  } catch (err) {
    // Keep messaging simple & executive
    setMsg(err?.message || "Unable to sign in. Please try again.", "error");
    setBusy(false);
  }
});

forgotBtn.addEventListener("click", async () => {
  setMsg("");
  setBusy(true);

  try {
    const email = $("email").value.trim();

    if (!email) {
      setMsg("Enter your email above, then click “Forgot password?”", "info");
      setBusy(false);
      return;
    }

    // ✅ Keeps flow within commercial portal
    // Also set this in Firebase Auth Templates: Action URL -> https://frontlineqsr.com/client-login.html
    await sendPasswordResetEmail(auth, email, {
      url: "https://frontlineqsr.com/client-login.html"
    });

    // Security best-practice: don’t confirm account existence
    setMsg("If an account exists for this email, you’ll receive a reset link.", "success");
  } catch (err) {
    setMsg("If an account exists for this email, you’ll receive a reset link.", "success");
  } finally {
    setBusy(false);
  }
});