const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /workers/profile - Create or update worker profile
router.post('/profile', auth, async (req, res, next) => {
  try {
    const {
      name,
      partner_id,
      platform,
      zone,
      pin_code,
      avg_active_hrs,
      avg_weekly_earn
    } = req.body;

    // Input validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
    }

    if (platform && !['zepto', 'blinkit'].includes(platform)) {
      return res.status(400).json({ error: "Platform must be either 'zepto' or 'blinkit'" });
    }

    // Sanitize inputs
    const sanitizedName = name.trim();
    const sanitizedPartnerId = partner_id ? partner_id.trim() : null;
    const sanitizedZone = zone ? zone.trim() : null;
    const sanitizedPinCode = pin_code ? pin_code.trim() : null;
    const sanitizedAvgActiveHrs = typeof avg_active_hrs === 'number' && avg_active_hrs > 0 ? avg_active_hrs : 8.0;
    const sanitizedAvgWeeklyEarn = typeof avg_weekly_earn === 'number' && avg_weekly_earn > 0 ? avg_weekly_earn : 4000;

    const userId = req.user.id;
    const userPhone = req.user.phone;

    // Security check: Ensure user can only modify their own profile
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot modify another user\'s profile' });
    }

    // Upsert worker profile
    const { data: worker, error } = await supabase
      .from('workers')
      .upsert({
        id: userId,
        phone: userPhone,
        name: sanitizedName,
        partner_id: sanitizedPartnerId,
        platform: sanitizedPlatform || null,
        zone: sanitizedZone,
        pin_code: sanitizedPinCode,
        avg_active_hrs: sanitizedAvgActiveHrs,
        avg_weekly_earn: sanitizedAvgWeeklyEarn,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ worker });
  } catch (err) {
    next(err);
  }
});

// GET /workers/:id - Get worker profile
router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid worker ID format' });
    }

    // Security check: Ensure user can only access their own profile
    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot access another worker\'s profile' });
    }

    const { data: worker, error } = await supabase
      .from('workers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Worker not found' });
      }
      throw error;
    }

    res.json({ worker });
  } catch (err) {
    next(err);
  }
});

// PATCH /workers/:id/fcm-token - Update FCM token
router.patch('/:id/fcm-token', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fcm_token } = req.body;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid worker ID format' });
    }

    // Security check: Ensure user can only update their own FCM token
    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Cannot update another worker\'s FCM token' });
    }

    // Validate FCM token (basic length check)
    if (fcm_token && (typeof fcm_token !== 'string' || fcm_token.length < 10)) {
      return res.status(400).json({ error: 'Invalid FCM token' });
    }

    const { error } = await supabase
      .from('workers')
      .update({ fcm_token: fcm_token || null })
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