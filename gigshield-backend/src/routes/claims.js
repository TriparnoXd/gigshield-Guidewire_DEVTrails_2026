const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

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

    // Get fraud score from ML service
    let fraudScore = 0;
    try {
      const fraudRes = await axios.post(`${process.env.ML_SERVICE_URL}/ml/fraud/score`, {
        worker_id,
        trigger_type,
        zone
      });
      fraudScore = fraudRes.data.fraud_score || 0;
    } catch (err) {
      console.log('[ML SERVICE] Fraud service unavailable, defaulting to 0');
      fraudScore = 0;
    }

    // Calculate hourly rate
    const hourlyRate = worker.avg_weekly_earn / (worker.avg_active_hrs * 7);

    // Generate claim number
    const year = new Date().getFullYear();
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
    const claimNumber = `GS-${year}-${randomNum}`;

    // Determine status based on fraud score
    let status = 'approved';
    if (fraudScore > 85) status = 'rejected';
    else if (fraudScore > 60) status = 'soft_hold';
    else if (fraudScore > 30) status = 'verifying';

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
        disruption_start,
        hourly_rate: hourlyRate,
        fraud_score: fraudScore,
        status,
        upi_id: `${worker_id.substring(0, 8)}@upi`
      })
      .select()
      .single();

    if (claimError) {
      throw claimError;
    }

    // Send FCM notification
    if (worker.fcm_token) {
      try {
        await axios.post('https://fcm.googleapis.com/fcm/send', {
          to: worker.fcm_token,
          notification: {
            title: 'GigShield Claim Created',
            body: `Your claim ${claimNumber} has been ${status}`
          }
        }, {
          headers: {
            Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (notifyErr) {
        console.log('[FCM] Failed to send notification:', notifyErr.message);
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

    // Get fraud flags (admin/internal only, not returned to worker in production)
    // For now, we'll return them for debugging
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

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (rejection_reason) {
      updateData.rejection_reason = rejection_reason;
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

    res.json({ claim });
  } catch (err) {
    next(err);
  }
});

// POST /claims/:id/settle - Settle claim and initiate payout
router.post('/:id/settle', internalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get claim details
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*, policies(*)')
      .eq('id', id)
      .single();

    if (claimError) {
      throw claimError;
    }

    if (!claim.disruption_end) {
      return res.status(400).json({ error: 'Disruption has not ended yet' });
    }

    // Calculate disruption hours
    const disruptionHours = (new Date(claim.disruption_end) - new Date(claim.disruption_start)) / (1000 * 60 * 60);

    // Calculate payout amount (capped at max weekly payout)
    let payoutAmount = disruptionHours * claim.hourly_rate;
    const maxPayout = claim.policies.max_weekly_payout;
    if (payoutAmount > maxPayout) {
      payoutAmount = maxPayout;
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
        amount: payoutAmount,
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
        disruption_hours: disruptionHours,
        payout_amount: payoutAmount
      })
      .eq('id', id);

    // Send FCM confirmation
    const { data: worker } = await supabase
      .from('workers')
      .select('fcm_token')
      .eq('id', claim.worker_id)
      .single();

    if (worker?.fcm_token) {
      try {
        await axios.post('https://fcm.googleapis.com/fcm/send', {
          to: worker.fcm_token,
          notification: {
            title: 'GigShield Payout Processed',
            body: `₹${payoutAmount.toFixed(2)} sent to ${claim.upi_id}`
          }
        }, {
          headers: {
            Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (notifyErr) {
        console.log('[FCM] Failed to send notification:', notifyErr.message);
      }
    }

    res.json({ payout: payoutRecord });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
