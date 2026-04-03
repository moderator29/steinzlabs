let _firebaseApp: any = null;
let _auth: any = null;
let _googleProvider: any = null;
let _appleProvider: any = null;
let _initPromise: Promise<void> | null = null;

const firebaseConfig = {
  apiKey: "AIzaSyBq4N0ot92FKC_7RyO-MXLLLNBcP9dH0",
  authDomain: "stringent-mvp.firebaseapp.com",
  projectId: "stringent-mvp",
  storageBucket: "stringent-mvp.firebasestorage.app",
  messagingSenderId: "510641880516",
  appId: "1:510641880516:web:f58f48216efeac47523891",
  measurementId: "G-1MTR0NSGMS"
};

async function initFirebase() {
  if (_auth) return;
  if (_initPromise) { await _initPromise; return; }

  _initPromise = (async () => {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth, GoogleAuthProvider, OAuthProvider } = await import('firebase/auth');

    _firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    _auth = getAuth(_firebaseApp);

    _googleProvider = new GoogleAuthProvider();
    _googleProvider.setCustomParameters({ prompt: 'select_account' });

    _appleProvider = new OAuthProvider('apple.com');
    _appleProvider.addScope('email');
    _appleProvider.addScope('name');
  })();

  await _initPromise;
}

export async function getFirebaseAuth() {
  await initFirebase();
  return _auth;
}

export async function getGoogleProvider() {
  await initFirebase();
  return _googleProvider;
}

export async function getAppleProvider() {
  await initFirebase();
  return _appleProvider;
}

export async function firebaseSignOut() {
  try {
    if (_auth) {
      const { signOut } = await import('firebase/auth');
      await signOut(_auth);
    }
  } catch {}
}
