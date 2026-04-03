const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Internal auth middleware
const internalAuth = (req, res, next) => {
  const internalKey = req.headers['x-internal-key'];
  if (internalKey !== process.env.INTERNAL_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// POST /triggers/log - Log a trigger event
router.post('/log', internalAuth, async (req, res, next) => {
  try {
    const {
      trigger_type,
      zone,
      reading_value,
      reading_unit,
      threshold_value,
      disruption_start
    } = req.body;

    const { data: triggerEvent, error } = await supabase
      .from('trigger_events')
      .insert({
        trigger_type,
        zone,
        reading_value,
        reading_unit,
        threshold_value,
        disruption_start: disruption_start || new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ trigger_event: triggerEvent });
  } catch (err) {
    next(err);
  }
});

// GET /triggers/active - Get all active triggers (admin only)
router.get('/active', internalAuth, async (req, res, next) => {
  try {
    const { data: activeTriggers, error } = await supabase
      .from('trigger_events')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ active_triggers: activeTriggers || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
