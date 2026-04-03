const cron = require('node-cron');
const axios = require('axios');
const supabase = require('../config/supabase');
const redis = require('../config/redis');

// Bengaluru zones
const ZONES = [
  'Koramangala',
  'Whitefield',
  'Indiranagar',
  'Hebbal',
  'HSR Layout',
];

const OUTAGE_DURATION_THRESHOLD = 60; // minutes

async function checkOutage() {
  for (const zone of ZONES) {
    try {
      // Call mock platform status API
      const res = await axios.get('http://localhost:3001/mock/platform-status', {
        timeout: 5000
      });

      const { status, since } = res.data;

      const redisKey = `trigger:outage:${zone}`;
      const existing = await redis.get(redisKey);

      if (status === 'down') {
        // Calculate outage duration
        const outageStart = new Date(since);
        const now = new Date();
        const durationMinutes = (now - outageStart) / (1000 * 60);

        if (durationMinutes > OUTAGE_DURATION_THRESHOLD && !existing) {
          const { data: triggerEvent } = await supabase
            .from('trigger_events')
            .insert({
              trigger_type: 'platform_outage',
              zone: zone,
              reading_value: durationMinutes,
              reading_unit: 'minutes',
              threshold_value: OUTAGE_DURATION_THRESHOLD,
              disruption_start: since,
              is_active: true,
              data_source: 'mock_platform_api'
            })
            .select()
            .single();

          await redis.setex(redisKey, 7200, triggerEvent.id);

          await redis.lpush('claims:queue', JSON.stringify({
            trigger_event_id: triggerEvent.id,
            trigger_type: 'platform_outage',
            zone: zone,
            disruption_start: since
          }));

          console.log(`[TRIGGER] Platform outage in ${zone}: ${Math.floor(durationMinutes)} min`);
        }
      } else if (status === 'up' && existing) {
        // Outage resolved
        await supabase
          .from('trigger_events')
          .update({
            disruption_end: new Date().toISOString(),
            is_active: false
          })
          .eq('id', existing);

        await redis.del(redisKey);
        console.log(`[TRIGGER] Platform outage cleared in ${zone}`);
      }
    } catch (err) {
      // Only log as error if it's not connection refused (mock API might not be running)
      if (err.code !== 'ECONNREFUSED') {
        console.error(`[TRIGGER ERROR] Outage check failed for ${zone}:`, err.message);
      }
    }
  }
}

// Run every 15 minutes
cron.schedule('*/15 * * * *', checkOutage);

module.exports = { checkOutage };
