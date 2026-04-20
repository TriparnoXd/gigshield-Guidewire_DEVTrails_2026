const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const { getPremiumMultiplier } = require('../services/premiumService');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Plan configuration
const PLAN_CONFIG = {
  basic: { base: 49, max_payout: 500, max_hours: 8 },
  standard: { base: 79, max_payout: 900, max_hours: 15 },
  pro: { base: 99, max_payout: 1400, max_hours: 22 }
};

// GET /policies/plans - Get available plans
router.get('/plans', async (req, res, next) => {
  try {
    const plans = Object.entries(PLAN_CONFIG).map(([id, config]) => ({
      id,
      ...config,
      name: id.charAt(0).toUpperCase() + id.slice(1) + ' Plan'
    }));
    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

// POST /policies/create - Create new policy
router.post('/create', auth, async (req, res, next) => {
  try {
    const { worker_id, plan } = req.body;

    // Input validation
    if (!worker_id || !plan) {
      return res.status(400).json({ error: 'worker_id and plan are required' });
    }

    if (!UUID_REGEX.test(worker_id)) {
      return res.status(400).json({ error: 'Invalid worker ID format' });
    }

    if (!PLAN_CONFIG[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Choose: basic, standard, pro' });
    }

    // Authorization check: users can only create policies for themselves
    if (worker_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot create policy for another worker' });
    }

    const planConfig = PLAN_CONFIG[plan];

    // Get multiplier from ML service — throws if unavailable
    const multiplier = await getPremiumMultiplier(worker_id, plan);

    const finalPremium = Math.round(planConfig.base * multiplier);

    // Calculate dates as proper Date objects
    const startDate = new Date();
    const endDate = new Date(startDate);
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
        start_date: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        end_date: endDate.toISOString().split('T')[0]      // YYYY-MM-DD format
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ policy }); // 201 for resource creation
  } catch (err) {
    next(err);
  }
});

// GET /policies/:workerId/active - Get active policy for worker
router.get('/:workerId/active', auth, async (req, res, next) => {
  try {
    const { workerId } = req.params;

    // Validate UUID format
    if (!UUID_REGEX.test(workerId)) {
      return res.status(400).json({ error: 'Invalid worker ID format' });
    }

    // Authorization check: users can only access their own policies
    if (workerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot access another worker\'s policies' });
    }

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

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid policy ID format' });
    }

    // First check if the policy belongs to the authenticated user
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select('worker_id')
      .eq('id', id)
      .single();

    if (policyError) {
      if (policyError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Policy not found' });
      }
      throw policyError;
    }

    // Authorization check: users can only cancel their own policies
    if (policy.worker_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot cancel another worker\'s policy' });
    }

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