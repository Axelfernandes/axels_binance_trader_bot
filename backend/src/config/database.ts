import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// In Cloud Run, ADC is provided by the runtime service account.
// For local dev, run: gcloud auth application-default login
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const resolvedCredential = (() => {
  if (!serviceAccountJson) {
    return applicationDefault();
  }

  try {
    return cert(JSON.parse(serviceAccountJson));
  } catch (error) {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON; falling back to application default credentials');
    return applicationDefault();
  }
})();

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: resolvedCredential,
      projectId: 'myportfoliowebsite-485116'
    });

export const db = getFirestore(app);
