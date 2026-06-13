/**
 * Firebase Firestore Configuration for SmartBin Challenge Arena
 * Edit this file with your own Firebase keys from the Firebase Console.
 */

// Placeholder configuration details
const firebaseConfig = {
  apiKey: "AIzaSyCFvLIOV3mvd3w6M9Junxc77zZ1SUhyxlY",
  authDomain: "smartbin-challenge.firebaseapp.com",
  projectId: "smartbin-challenge",
  storageBucket: "smartbin-challenge.firebasestorage.app",
  messagingSenderId: "945156502030",
  appId: "1:945156502030:web:d2086ac7df42f0c4b2425f"
};

let db = null;
let isFirebaseFallback = false;

try {
  // Check if firebase script is loaded
  if (typeof firebase !== 'undefined') {
    // If placeholders aren't replaced, trigger a warning in the console but don't break the code
    if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE" || !firebaseConfig.projectId) {
      console.warn("Firebase config placeholders detected. Entering LocalStorage Demo Fallback mode. Please update js/firebase-config.js to connect Firestore!");
      isFirebaseFallback = true;
    } else {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();

      // Enable Firestore offline persistence to support mobile networks
      db.enablePersistence().catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("Firestore offline persistence failed: Multiple tabs open.");
        } else if (err.code == 'unimplemented') {
          console.warn("Firestore offline persistence not supported by current browser.");
        }
      });
      console.log("Firebase Firestore successfully initialized!");
    }
  } else {
    console.warn("Firebase script tags not loaded. Entering LocalStorage Demo Fallback mode.");
    isFirebaseFallback = true;
  }
} catch (e) {
  console.error("Firebase failed to initialize. Entering LocalStorage Demo Fallback mode.", e);
  isFirebaseFallback = true;
}

export { db, isFirebaseFallback };
