const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Create anon client for auth operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// POST /auth/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const { error } = await supabase.auth.signInWithOtp({ phone });

    if (error) {
      throw error;
    }

    res.json({ message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, token } = req.body;

    if (!phone || !token) {
      return res.status(400).json({ error: 'Phone and token are required' });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms'
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid OTP', code: 'INVALID_OTP' });
    }

    // Get or create worker
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, phone')
      .eq('phone', phone)
      .single();

    if (workerError && workerError.code !== 'PGRST116') {
      throw workerError;
    }

    // Return worker if exists, otherwise just return access_token
    res.json({
      access_token: data.session.access_token,
      worker: worker || { id: null, phone }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
