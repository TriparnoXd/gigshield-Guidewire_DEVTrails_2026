const admin = require('firebase-admin');

// Initialize Firebase Admin for FCM
// In production, use service account JSON file
// For now, we'll initialize with the server key
const initFirebase = () => {
  try {
    if (!admin.apps.length) {
      // For FCM with only server key, we use HTTP API approach in notifyService
      // This file is kept for future expansion with full Firebase Admin setup
      console.log('[FIREBASE] Initialized for FCM HTTP API');
    }
  } catch (err) {
    console.error('[FIREBASE ERROR]', err.message);
  }
};

module.exports = { admin, initFirebase };
