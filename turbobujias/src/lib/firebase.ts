import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

export async function verifyFirestoreConnection(retries = 3) {
  console.log("Firebase: Testing Firestore connection to path: test/connection");
  for (let i = 0; i < retries; i++) {
    try {
      const testDoc = doc(db, 'test', 'connection');
      const snapshot = await getDocFromServer(testDoc);
      console.log("Firebase: Firestore connection successful. Doc exists:", snapshot.exists());
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Firebase Connection Attempt ${i + 1} Failed:`, msg);
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Incremental backoff
      } else if (msg.includes('auth/operation-not-allowed')) {
        console.error("FIREBASE ERROR: The 'Google' sign-in provider is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable Google.");
      } else if (msg.includes('the client is offline')) {
        console.error("Please check your Firebase configuration or internet connection.");
      } else if (msg.includes('unavailable')) {
        console.warn("Firestore backend is currently unavailable. This may be temporary or due to network restrictions. Long polling is enabled.");
      }
    }
  }
  return false;
}
