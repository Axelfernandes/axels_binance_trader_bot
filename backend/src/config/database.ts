import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// In Cloud Run, ADC is provided by the runtime service account.
// For local dev, run: gcloud auth application-default login
const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: applicationDefault(),
      projectId: 'myportfoliowebsite-485116'
    });

export const db = getFirestore(app);
