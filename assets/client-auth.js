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

/**
 * IMPORTANT:
 * Use the SAME Firebase project as flqsr.com (shared backend).
 * Users are separated by Firestore profile: users/{uid}.portal = "commercial" or "pilot"
 */
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const loginForm = $("loginForm");
const loginBtn = $("loginBtn");
const forgotBtn = $("forgotBtn");
const msg = $("msg");

function setMsg(text = "", type = "") {
  msg.textContent = text;
  msg.className = `msg ${type}`.trim();
}
function setBusy(b) {
  loginBtn.disabled = b;
  forgotBtn.disabled = b;
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

function goToAppHome() {
  // Commercial portal landing page (KPIs first screen)
  window.location.href = "/app/kpis.html";
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

    if (!profile) throw new Error("Account is not fully provisioned.");

    // ✅ Access layer: commercial only
    if (profile.portal !== "commercial") {
      throw new Error("This account does not have access to the client portal.");
    }

    goToAppHome();
  } catch (err) {
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
      setMsg("Enter your email above, then click “Forgot password?”", "");
      setBusy(false);
      return;
    }

    // ✅ Keeps reset flow returning to this commercial login page
    await sendPasswordResetEmail(auth, email, {
      url: "https://frontlineqsr.com/client-login.html"
    });

    // Privacy/security: do not confirm account existence
    setMsg("If an account exists for this email, you’ll receive a reset link.", "success");
  } catch {
    setMsg("If an account exists for this email, you’ll receive a reset link.", "success");
  } finally {
    setBusy(false);
  }
});
