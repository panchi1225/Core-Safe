// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // データベースを使うための機能を追加

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
const app = initializeApp(firebaseConfig);

// データベースを使えるようにして、他のファイルから呼び出せるようにする
export const db = getFirestore(app);