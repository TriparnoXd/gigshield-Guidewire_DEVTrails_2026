const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

const PLAN_CONFIG = {
  basic: { base: 49, max_payout: 500, max_hours: 8 },
  standard: { base: 79, max_payout: 900, max_hours: 15 },
  pro: { base: 99, max_payout: 1400, max_hours: 22 }
};

// POST /policies/create - Create new policy
router.post('/create', auth, async (req, res, next) => {
  try {
    const { worker_id, plan } = req.body;

    if (!worker_id || !plan) {
      return res.status(400).json({ error: 'worker_id and plan are required' });
    }

    if (!PLAN_CONFIG[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Choose: basic, standard, pro' });
    }

    const planConfig = PLAN_CONFIG[plan];

    // Get multiplier from ML service
    let multiplier = 1.0;
    try {
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/ml/premium/calculate`, {
        worker_id,
        plan
      });
      multiplier = mlRes.data.multiplier || 1.0;
    } catch (err) {
      console.log('[ML SERVICE] Unavailable, using default multiplier 1.0');
      multiplier = 1.0;
    }

    const finalPremium = Math.round(planConfig.base * multiplier);

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    // Insert policy
    const { data: policy, error } = await supabase
      .from('policies')
      .insert({
        worker_id,
        plan,
        base_premium: planConfig.base,
        multiplier,
        final_premium: finalPremium,
        max_weekly_payout: planConfig.max_payout,
        max_coverage_hrs: planConfig.max_hours,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ policy });
  } catch (err) {
    next(err);
  }
});

// GET /policies/:workerId/active - Get active policy for worker
router.get('/:workerId/active', auth, async (req, res, next) => {
  try {
    const { workerId } = req.params;

    const { data: policy, error } = await supabase
      .from('policies')
      .select('*')
      .eq('worker_id', workerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    res.json({ policy });
  } catch (err) {
    next(err);
  }
});

// PATCH /policies/:id/cancel - Cancel a policy
router.patch('/:id/cancel', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('policies')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
