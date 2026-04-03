const axios = require('axios');

/**
 * Get fraud score from ML service
 * @param {string} worker_id
 * @param {string} trigger_type
 * @param {string} zone
 * @returns {Promise<number>} fraud score (0-100)
 */
async function getFraudScore(worker_id, trigger_type, zone) {
  try {
    const res = await axios.post(
      `${process.env.ML_SERVICE_URL}/ml/fraud/score`,
      { worker_id, trigger_type, zone },
      { timeout: 5000 } // 5 second timeout
    );
    return res.data.fraud_score || 0;
  } catch (err) {
    console.log('[FRAUD SERVICE] ML service unavailable or timeout, defaulting to 0');
    return 0;
  }
}

/**
 * Determine claim status from fraud score
 * @param {number} fraudScore
 * @returns {string} claim status
 */
function getStatusFromFraudScore(fraudScore) {
  if (fraudScore > 85) return 'rejected';
  if (fraudScore > 60) return 'soft_hold';
  if (fraudScore > 30) return 'verifying';
  return 'approved';
}

module.exports = { getFraudScore, getStatusFromFraudScore };