// /assets/firebase.js - Firebase init (ES Module) + Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Your Firebase config (keep exactly as your project)
const firebaseConfig = {
  apiKey: "AIzaSyANTxxbSP4UMmEmrOKH8wn2UhR2GUmWiYc",
  authDomain: "frontlineqsr-prod.firebaseapp.com",
  projectId: "frontlineqsr-prod",
  storageBucket: "frontlineqsr-prod.firebasestorage.app",
  messagingSenderId: "114632679759",
  appId: "1:114632679759:web:6e207548b5a29fcecaa53a",
  measurementId: "G-8KFEXHE1TR"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
