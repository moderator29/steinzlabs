'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBq4N0ot92FKC_7RyO-MXLLLNBcP9dH0",
  authDomain: "stringent-mvp.firebaseapp.com",
  projectId: "stringent-mvp",
  storageBucket: "stringent-mvp.firebasestorage.app",
  messagingSenderId: "510641880516",
  appId: "1:510641880516:web:f58f48216efeac47523891",
  measurementId: "G-1MTR0NSGMS"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export { auth, googleProvider, appleProvider };
