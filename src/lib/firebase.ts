import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';

import configJson from '../../firebase-applet-config.json';

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: configJson.apiKey || env.VITE_FIREBASE_API_KEY || '',
  authDomain: configJson.authDomain || env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: configJson.projectId || env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: configJson.storageBucket || env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: configJson.messagingSenderId || env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: configJson.appId || env.VITE_FIREBASE_APP_ID || '',
  firestoreDatabaseId: configJson.firestoreDatabaseId || '(default)',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain);

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  const cacheConfig = {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  };

  const customDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

  try {
    db = customDbId
      ? initializeFirestore(app, cacheConfig, customDbId)
      : initializeFirestore(app, cacheConfig);
  } catch {
    // In case Firestore is already initialized in this process
    db = customDbId
      ? getFirestore(app, customDbId)
      : getFirestore(app);
  }
} catch (err) {
  console.warn('Firebase initialization notice:', err);
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}

export enum OperationType {
  CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: { userId?: string | null; email?: string | null; emailVerified?: boolean | null; isAnonymous?: boolean | null };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: auth?.currentUser?.uid || null, email: auth?.currentUser?.email || null, emailVerified: auth?.currentUser?.emailVerified || null, isAnonymous: auth?.currentUser?.isAnonymous || null },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isFirestoreFieldValue(val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;
  if (val instanceof Date) return false;
  const proto = Object.getPrototypeOf(val);
  const name = (val as any).constructor?.name || proto?.constructor?.name || '';
  if (name.includes('FieldValue') || name.includes('Increment') || name.includes('Timestamp')) return true;
  if ('_methodName' in (val as Record<string, unknown>)) return true;
  if (typeof (val as any).isEqual === 'function' && typeof (val as any).toDebugString === 'function') return true;
  return false;
}

export function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) return null as unknown as T;
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof Date) return val;
  if (isFirestoreFieldValue(val)) return val;
  if (Array.isArray(val)) return val.filter((item) => item !== undefined).map((item) => sanitizeForFirestore(item)) as unknown as T;
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) if (value !== undefined) cleanObj[key] = sanitizeForFirestore(value);
  return cleanObj as T;
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

export {
  app, auth, db,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, firebaseSignOut,
  sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider, signInWithPopup,
  updateProfile, onAuthStateChanged,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, increment,
};

export type { FirebaseUser };

export function formatAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code || 'unknown') : 'unknown';
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Unknown authentication error');
  const normalizedCode = code.startsWith('auth/') ? code : `auth/${code}`;
  switch (normalizedCode) {
    case 'auth/invalid-credential': case 'auth/wrong-password': return 'Invalid email or password.';
    case 'auth/user-not-found': return 'No Firebase account exists with this email.';
    case 'auth/user-disabled': return 'This Firebase account has been disabled.';
    case 'auth/email-already-in-use': return 'An account already exists with this email.';
    case 'auth/weak-password': return 'Password is too weak. Use at least 8 characters.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed': return 'This sign-in method is disabled in Firebase Authentication. Enable the required provider in Firebase Console → Authentication → Sign-in method.';
    case 'auth/unauthorized-domain': case 'auth/app-not-authorized': return 'This website domain is not authorized in Firebase Authentication.';
    case 'auth/invalid-api-key': case 'auth/api-key-not-valid': return 'Firebase configuration is invalid. Check the Firebase web configuration.';
    case 'auth/network-request-failed': return 'Firebase could not connect to the authentication service. Check your internet connection.';
    case 'auth/too-many-requests': return 'Too many authentication attempts. Please wait and try again later.';
    case 'auth/popup-blocked': return 'The Google sign-in popup was blocked by your browser.';
    case 'auth/popup-closed-by-user': return 'The Google sign-in popup was closed before sign-in completed.';
    case 'auth/account-exists-with-different-credential': return 'An account already exists using a different sign-in method.';
    case 'auth/requires-recent-login': return 'Please sign in again before performing this action.';
    default: console.error('Unhandled Firebase Auth error:', { code: normalizedCode, message: rawMessage, error }); return `Firebase authentication failed [${normalizedCode}]: ${rawMessage}`;
  }
}
