const axios = require('axios');

/**
 * Get premium multiplier from ML service
 * @param {string} worker_id
 * @param {string} plan
 * @returns {Promise<number>} multiplier
 */
async function getPremiumMultiplier(worker_id, plan) {
  try {
    const res = await axios.post(
      `${process.env.ML_SERVICE_URL}/ml/premium/calculate`,
      { worker_id, plan },
      { timeout: 5000 } // 5 second timeout
    );
    return res.data.multiplier || 1.0;
  } catch (err) {
    console.log('[PREMIUM SERVICE] ML service unavailable or timeout, defaulting to 1.0');
    return 1.0;
  }
}

module.exports = { getPremiumMultiplier };