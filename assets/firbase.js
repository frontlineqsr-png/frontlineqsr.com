// assets/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "frontlineqsr-prod.firebaseapp.com",
  projectId: "frontlineqsr-prod",
  storageBucket: "frontlineqsr-prod.firebasestorage.app",
  messagingSenderId: "114632679759",
  appId: "1:114632679759:web:6e207548b5a29fcecaa53a",
  measurementId: "G-8KFEXHE1TR"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
