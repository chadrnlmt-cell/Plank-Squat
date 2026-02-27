// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyD8kDlREA7WEENXQQSDFjtdkjCEaQYaGdQ",
  authDomain: "plank-and-squat.firebaseapp.com",
  projectId: "plank-and-squat",
  storageBucket: "plank-and-squat.firebasestorage.app",
  messagingSenderId: "586593177213",
  appId: "1:586593177213:web:acf54189c464b71850eb14",
  measurementId: "G-D63274ZH09",
};

const app = initializeApp(firebaseConfig);

// Initialize App Check with reCAPTCHA v3
// This runs silently in the background to verify requests come from your legitimate app
// No user interaction required - works automatically to block bots
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LfhH3osAAAAABh3bEMcmOi8d9f-y3mlp1ZXM5rY'),
  isTokenAutoRefreshEnabled: true // Automatically refresh tokens before they expire
});

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider, db, appCheck };
