const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Create anon client for auth operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Phone number validation regex (Indian mobile numbers)
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

// POST /auth/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone } = req.body;

    // Input validation
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Sanitize and validate phone number
    const sanitizedPhone = phone.trim();
    if (!PHONE_REGEX.test(sanitizedPhone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const { error } = await supabase.auth.signInWithOtp({ phone: sanitizedPhone });

    if (error) {
      // Don't expose Supabase error details to client
      console.error('[AUTH] OTP send error:', error.message);
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

    // Input validation
    if (!phone || !token) {
      return res.status(400).json({ error: 'Phone and token are required' });
    }

    // Sanitize inputs
    const sanitizedPhone = phone.trim();
    const sanitizedToken = token.trim();

    if (!PHONE_REGEX.test(sanitizedPhone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    if (sanitizedToken.length < 4 || sanitizedToken.length > 10) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone: sanitizedPhone,
      token: sanitizedToken,
      type: 'sms'
    });

    if (error) {
      // Don't expose Supabase error details to client
      console.error('[AUTH] OTP verify error:', error.message);
      return res.status(401).json({ error: 'Invalid OTP', code: 'INVALID_OTP' });
    }

    // Get or create worker
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, phone')
      .eq('phone', sanitizedPhone)
      .single();

    if (workerError && workerError.code !== 'PGRST116') {
      throw workerError;
    }

    // Return worker if exists, otherwise just return access_token
    res.json({
      access_token: data.session.access_token,
      worker: worker || { id: null, phone: sanitizedPhone }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;