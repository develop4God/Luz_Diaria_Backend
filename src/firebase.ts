import admin from "firebase-admin";
import { env, IS_DEV } from "./env";

let firebaseApp: admin.app.App;

/**
 * Initialize Firebase Admin SDK
 * On production: uses Google Cloud service account credentials
 * On dev: uses emulator if available, otherwise requires FIREBASE_CONFIG env var
 */
export function initFirebase() {
  if (firebaseApp) return firebaseApp;

  try {
    if (IS_DEV && process.env.FIREBASE_EMULATOR_HOST) {
      console.log(`[Firebase] Using emulator at ${process.env.FIREBASE_EMULATOR_HOST}`);
    }

    // Initialize with Application Default Credentials (ADC)
    // In production: set via Google Cloud service account JSON
    // In dev: use emulator or local credentials
    firebaseApp = admin.initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
    });

    console.log(`✅ [Firebase] Initialized successfully for project: ${env.FIREBASE_PROJECT_ID}`);
    return firebaseApp;
  } catch (err) {
    console.error("❌ [Firebase] Initialization failed:", err);
    throw err;
  }
}

/**
 * Get Firebase Auth instance
 */
export function getAuth(): admin.auth.Auth {
  if (!firebaseApp) {
    initFirebase();
  }
  return admin.auth(firebaseApp);
}

/**
 * Verify Firebase ID Token
 * Used by auth middleware to validate incoming tokens
 */
export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  const auth = getAuth();
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    console.warn(`[Firebase] Token verification failed:`, err);
    throw err;
  }
}
