const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

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

    const userId = req.user.id;
    const userPhone = req.user.phone;

    // Upsert worker profile
    const { data: worker, error } = await supabase
      .from('workers')
      .upsert({
        id: userId,
        phone: userPhone,
        name,
        partner_id,
        platform,
        zone,
        pin_code,
        avg_active_hrs: avg_active_hrs || 8.0,
        avg_weekly_earn: avg_weekly_earn || 4000,
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

    const { error } = await supabase
      .from('workers')
      .update({ fcm_token })
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
