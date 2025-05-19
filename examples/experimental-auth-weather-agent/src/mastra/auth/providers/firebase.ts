import { defineAuth } from '@mastra/core/server';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (process.env.AUTH_PROVIDER === 'firebase') {
  admin.initializeApp({
    credential: admin.credential.cert(process.env.FIREBASE_CREDENTIALS!),
  });
}

export const firebaseAuth = defineAuth({
  async authenticateToken(token, request) {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  },
  async authorize(request, method, user) {
    const db = getFirestore(process.env.FIREBASE_DATABASE_ID!);
    const userAccess = await db.doc(`/user_access/${user.uid}`).get();
    const userAccessData = userAccess.data();

    if (!userAccessData) {
      return false;
    }

    return true;
  },
});
