import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// In AI Studio, calling the set_up_firebase tool drops a configuration 
// file named firebase-applet-config.json at the root of the project.
let firebaseConfig: any = {};
try {
  firebaseConfig = await import('../../firebase-applet-config.json');
  // Need to unwrap the default export when using import() on JSON in some bundler setups
  if (firebaseConfig.default) {
    firebaseConfig = firebaseConfig.default;
  }
} catch (error) {
  console.warn('Firebase config not found! Run the Firebase setup tool.');
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: We pass the databaseId if provided to use standard/enterprise as configured
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);
