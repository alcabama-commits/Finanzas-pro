import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
// Add Google Sheets and Drive write scopes
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Access token caching with localStorage fallback
let cachedAccessToken: string | null = null;
try {
  cachedAccessToken = localStorage.getItem('google_oauth_access_token');
} catch (e) {
  console.warn('Error reading token from localStorage:', e);
}

export const getCachedToken = () => cachedAccessToken;
export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('google_oauth_access_token', token);
    } else {
      localStorage.removeItem('google_oauth_access_token');
    }
  } catch (e) {
    console.warn('Error writing token to localStorage:', e);
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setCachedToken(credential.accessToken);
    }
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Clear the cached token on sign out
auth.onAuthStateChanged((user) => {
  if (!user) {
    setCachedToken(null);
  }
});

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
