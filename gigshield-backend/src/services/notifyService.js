const axios = require('axios');

/**
 * Send FCM push notification
 * @param {string} fcmToken
 * @param {string} title
 * @param {string} body
 * @returns {Promise<void>}
 */
async function sendPushNotification(fcmToken, title, body) {
  if (!fcmToken) {
    console.log('[NOTIFY] No FCM token provided');
    return;
  }

  try {
    await axios.post('https://fcm.googleapis.com/fcm/send', {
      to: fcmToken,
      notification: { title, body }
    }, {
      headers: {
        Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5 second timeout
    });
    console.log('[NOTIFY] Push notification sent successfully');
  } catch (err) {
    console.log('[NOTIFY] Failed to send notification:', err.message);
    // Re-throw error for callers who want to handle it
    throw err;
  }
}

/**
 * Send claim created notification
 * @param {string} fcmToken
 * @param {string} claimNumber
 * @param {string} status
 */
async function sendClaimCreatedNotification(fcmToken, claimNumber, status) {
  return sendPushNotification(
    fcmToken,
    'GigShield Claim Created',
    `Your claim ${claimNumber} has been ${status}`
  );
}

/**
 * Send payout notification
 * @param {string} fcmToken
 * @param {number} amount
 * @param {string} upiId
 */
async function sendPayoutNotification(fcmToken, amount, upiId) {
  return sendPushNotification(
    fcmToken,
    'GigShield Payout Processed',
    `₹${amount.toFixed(2)} sent to ${upiId}`
  );
}

module.exports = {
  sendPushNotification,
  sendClaimCreatedNotification,
  sendPayoutNotification
};