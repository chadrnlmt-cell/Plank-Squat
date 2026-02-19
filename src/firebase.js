// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8kDlREA7WEENXQQSDFjtdkjCEaQYaGdQ",
  authDomain: "plank-and-squat.firebaseapp.com",
  projectId: "plank-and-squat",
  storageBucket: "plank-and-squat.firebasestorage.app",
  messagingSenderId: "586593177213",
  appId: "1:586593177213:web:acf54189c464b71850eb14",
  measurementId: "G-D63274ZH09",
};

const app = initializeApp(firebaseConfig); // initialize the Firebase app [web:46][web:52]

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider, db };
