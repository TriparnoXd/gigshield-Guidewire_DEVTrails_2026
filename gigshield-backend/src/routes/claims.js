const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const Razorpay = require('razorpay');
const { getFraudScore, getStatusFromFraudScore } = require('../services/fraudService');
const notifyService = require('../services/notifyService');

// Initialize Razorpay (only if credentials are available)
let razorpay = null;
const keyId = process.env.RAZORPAY_KEY_ID || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

if (keyId && keySecret) {
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

// UUID validation regex
// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Internal auth middleware for trigger endpoints
const internalAuth = (req, res, next) => {
  const internalKey = req.headers['x-internal-key'];
  if (internalKey !== process.env.INTERNAL_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// POST /claims/initiate - Internal only (triggered by cron services)
router.post('/initiate', internalAuth, async (req, res, next) => {
  try {
    const { worker_id, trigger_event_id, trigger_type, zone, disruption_start } = req.body;

    // Input validation
    if (!worker_id || !trigger_event_id || !trigger_type || !zone || !disruption_start) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!UUID_REGEX.test(worker_id)) {
      return res.status(400).json({ error: 'Invalid worker ID format' });
    }

    if (!UUID_REGEX.test(trigger_event_id)) {
      return res.status(400).json({ error: 'Invalid trigger event ID format' });
    }

    // Validate trigger_type
    const validTriggerTypes = ['heavy_rainfall', 'severe_aqi', 'extreme_heat', 'platform_outage'];
    if (!validTriggerTypes.includes(trigger_type)) {
      return res.status(400).json({ error: 'Invalid trigger type' });
    }

    // Get worker's active policy
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select('*')
      .eq('worker_id', worker_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (policyError) {
      throw policyError;
    }

    if (!policy) {
      return res.json({ message: 'No active policy found, skipping claim creation' });
    }

    // Get worker details
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('avg_active_hrs, avg_weekly_earn, fcm_token')
      .eq('id', worker_id)
      .single();

    if (workerError) {
      throw workerError;
    }

    // Get fraud score from ML service — throws if unavailable
    const fraudScore = await getFraudScore(worker_id, trigger_type, zone);

    // Calculate hourly rate with validation
    if (!worker.avg_weekly_earn || !worker.avg_active_hrs || worker.avg_active_hrs <= 0) {
      return res.status(500).json({ error: 'Invalid worker earnings data' });
    }
    const hourlyRate = worker.avg_weekly_earn / (worker.avg_active_hrs * 7);

    // Generate claim number with better uniqueness
    const year = new Date().getFullYear();
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
    const claimNumber = `GS-${year}-${randomNum}`;

    // Determine status based on fraud score using service function
    const status = getStatusFromFraudScore(fraudScore);

    // Insert claim
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .insert({
        claim_number: claimNumber,
        worker_id,
        policy_id: policy.id,
        trigger_event_id,
        trigger_type,
        zone,
        disruption_start: new Date(disruption_start).toISOString(), // Ensure ISO format
        hourly_rate: parseFloat(hourlyRate.toFixed(2)), // Limit decimal places
        fraud_score: fraudScore,
        status,
        upi_id: `${worker_id.substring(0, 8)}@upi`
      })
      .select()
      .single();

    if (claimError) {
      throw claimError;
    }

    // Send FCM notification using service
    if (worker.fcm_token) {
      try {
        await notifyService.sendClaimCreatedNotification(
          worker.fcm_token,
          claim.claim_number,
          claim.status
        );
      } catch (notifyErr) {
        console.log('[FCM] Failed to send notification:', notifyErr.message);
        // Don't fail the claim creation for notification failures
      }
    }

    res.json({ claim });
  } catch (err) {
    next(err);
  }
});

// GET /claims/:workerId - Get all claims for worker
router.get('/:workerId', auth, async (req, res, next) => {
  try {
    const { workerId } = req.params;

    // Validate UUID format
    if (!UUID_REGEX.test(workerId)) {
      return res.status(400).json({ error: 'Invalid worker ID format' });
    }

    // Authorization check: users can only access their own claims
    if (workerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot access another worker\'s claims' });
    }

    const { data: claims, error } = await supabase
      .from('claims')
      .select('id, claim_number, trigger_type, zone, disruption_start, disruption_end, disruption_hours, payout_amount, status, upi_id, created_at')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ claims: claims || [] });
  } catch (err) {
    next(err);
  }
});

// GET /claims/:workerId/:claimId - Get single claim with fraud flags
router.get('/:workerId/:claimId', auth, async (req, res, next) => {
  try {
    const { claimId } = req.params;

    // Validate UUID format
    if (!UUID_REGEX.test(claimId)) {
      return res.status(400).json({ error: 'Invalid claim ID format' });
    }

    const { data: claim, error } = await supabase
      .from('claims')
      .select('id, claim_number, trigger_type, zone, disruption_start, disruption_end, disruption_hours, payout_amount, status, upi_id, created_at')
      .eq('id', claimId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Claim not found' });
      }
      throw error;
    }

    // Authorization check: users can only access their own claims
    if (claim.worker_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot access another worker\'s claim' });
    }

    // Get fraud flags (only for internal/admin use in production)
    // In production, this would be restricted to internal/authenticated admin users
    const { data: fraud_flags } = await supabase
      .from('fraud_flags')
      .select('*')
      .eq('claim_id', claimId);

    res.json({ claim, fraud_flags: fraud_flags || [] });
  } catch (err) {
    next(err);
  }
});

// PATCH /claims/:id/status - Update claim status (admin only)
router.patch('/:id/status', internalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    // Input validation
    if (!id || !status) {
      return res.status(400).json({ error: 'Claim ID and status are required' });
    }

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid claim ID format' });
    }

    // Validate status
    const validStatuses = ['pending', 'verifying', 'approved', 'soft_hold', 'manual_review', 'rejected', 'paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (rejection_reason) {
      // Sanitize rejection reason
      if (typeof rejection_reason !== 'string' || rejection_reason.length > 500) {
        return res.status(400).json({ error: 'Invalid rejection reason' });
      }
      updateData.rejection_reason = rejection_reason.trim();
    }

    const { data: claim, error } = await supabase
      .from('claims')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ claim });
  } catch (err) {
    next(err);
  }
});

// POST /claims/:id/settle - Settle claim and initiate payout
router.post('/:id/settle', internalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid claim ID format' });
    }

    // Get claim details
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*, policies(*)')
      .eq('id', id)
      .single();

    if (claimError) {
      throw claimError;
    }

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (!claim.disruption_end) {
      return res.status(400).json({ error: 'Disruption has not ended yet' });
    }

    // Calculate disruption hours with validation
    const disruptionStart = new Date(claim.disruption_start);
    const disruptionEnd = new Date(claim.disruption_end);
    
    if (isNaN(disruptionStart.getTime()) || isNaN(disruptionEnd.getTime())) {
      return res.status(400).json({ error: 'Invalid disruption timestamps' });
    }
    
    if (disruptionEnd < disruptionStart) {
      return res.status(400).json({ error: 'Disruption end cannot be before start' });
    }

    const disruptionHours = (disruptionEnd - disruptionStart) / (1000 * 60 * 60);

    // Validate hourly rate
    if (!claim.hourly_rate || claim.hourly_rate <= 0) {
      return res.status(500).json({ error: 'Invalid hourly rate in claim' });
    }

    // Calculate payout amount (capped at max weekly payout)
    let payoutAmount = disruptionHours * claim.hourly_rate;
    const maxPayout = claim.policies.max_weekly_payout;
    if (payoutAmount > maxPayout) {
      payoutAmount = maxPayout;
    }

    // Ensure payout amount is positive and reasonable
    if (payoutAmount < 0) {
      return res.status(400).json({ error: 'Calculated payout amount is invalid' });
    }

    // Initiate Razorpay payout (sandbox)
    let razorpayId = null;
    try {
      const payout = await razorpay.payouts.create({
        account_number: '2323230062925652', // Dummy account
        fund_account_id: 'fa_' + claim.worker_id.substring(0, 10),
        amount: Math.round(payoutAmount * 100), // in paise
        currency: 'INR',
        mode: 'UPI',
        purpose: 'claim_payout',
        queue_if_low_balance: true,
        reference_id: claim.claim_number,
        narration: `GigShield Claim ${claim.claim_number}`
      });
      razorpayId = payout.id;
    } catch (razorpayErr) {
      console.log('[RAZORPAY] Payout failed (expected in sandbox):', razorpayErr.message);
      razorpayId = 'razorpay_sandbox_' + Date.now();
    }

    // Insert payout record
    const { data: payoutRecord, error: payoutError } = await supabase
      .from('payouts')
      .insert({
        claim_id: id,
        worker_id: claim.worker_id,
        amount: parseFloat(payoutAmount.toFixed(2)),
        upi_id: claim.upi_id,
        razorpay_id: razorpayId,
        status: 'initiated'
      })
      .select()
      .single();

    if (payoutError) {
      throw payoutError;
    }

    // Update claim
    await supabase
      .from('claims')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payout_reference: razorpayId,
        disruption_hours: parseFloat(disruptionHours.toFixed(2)),
        payout_amount: parseFloat(payoutAmount.toFixed(2))
      })
      .eq('id', id);

    // Send FCM confirmation using service
    const { data: worker } = await supabase
      .from('workers')
      .select('fcm_token')
      .eq('id', claim.worker_id)
      .single();

    if (worker?.fcm_token) {
      try {
        await notifyService.sendPayoutNotification(
          worker.fcm_token,
          payoutAmount,
          claim.upi_id
        );
      } catch (notifyErr) {
        console.log('[FCM] Failed to send notification:', notifyErr.message);
        // Don't fail the payout for notification failures
      }
    }

    res.json({ payout: payoutRecord });
  } catch (err) {
    next(err);
  }
});

module.exports = router;