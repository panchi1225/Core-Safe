// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // データベースを使うための機能を追加
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCYT45WYMTTCpp3MDvUShT1yEwz-x9mYWQ",
  authDomain: "core-safe.firebaseapp.com",
  projectId: "core-safe",
  storageBucket: "core-safe.firebasestorage.app",
  messagingSenderId: "538945747105",
  appId: "1:538945747105:web:09373b659159a8b8c618e0"
};

// Initialize Firebase
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
export const app = initializeApp(useEmulators ? { ...firebaseConfig, projectId: 'demo-core-safe', apiKey: 'demo-key' } : firebaseConfig);

// データベースを使えるようにして、他のファイルから呼び出せるようにする
export const db = getFirestore(app);
export const auth = getAuth(app);
if (useEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 18080);
  connectAuthEmulator(auth, 'http://127.0.0.1:19099', { disableWarnings: true });
}
// A future App Check initializer can use this same app. No production
// enforcement/debug provider is enabled by this authentication change.
