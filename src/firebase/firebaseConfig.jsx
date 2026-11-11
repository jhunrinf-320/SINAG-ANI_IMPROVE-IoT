
import { initializeApp, getApps, getApp } from "firebase/app";

import {
  getDatabase,
  ref,
  onValue,
  set,
  query,
  limitToLast
} from "firebase/database";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAcFpxULijePBCmRsZgw5FSWpUUY10XKAU",
  authDomain: "sinag-ani-iot.firebaseapp.com",
  databaseURL:
    "https://sinag-ani-iot-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sinag-ani-iot",
  storageBucket: "sinag-ani-iot.firebasestorage.app",
  messagingSenderId: "505006165687",
  appId: "1:505006165687:web:8d930c2a846a978a41c732",
  measurementId: "G-F1YD6L3XNL"
};

// Initialize Firebase only once
const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// Initialize services
const database = getDatabase(app);
const auth = getAuth(app);

// Export Firebase services and required functions
export {
  app,
  database,
  auth,
  ref,
  onValue,
  set,
  query,
  limitToLast,
  signInAnonymously,
  onAuthStateChanged
};

export default app;
