const cron = require('node-cron');
const axios = require('axios');
const supabase = require('../config/supabase');
const redis = require('../config/redis');

// Bengaluru zones with coordinates
const ZONES = [
  { name: 'Koramangala', lat: 12.9352, lon: 77.6245 },
  { name: 'Whitefield',  lat: 12.9698, lon: 77.7499 },
  { name: 'Indiranagar', lat: 12.9784, lon: 77.6408 },
  { name: 'Hebbal',      lat: 13.0358, lon: 77.5970 },
  { name: 'HSR Layout',  lat: 12.9116, lon: 77.6389 },
];

const RAINFALL_THRESHOLD = 15; // mm/hr

// Lock to prevent overlapping executions
let isRunning = false;

async function checkRainfall() {
  // Prevent overlapping executions
  if (isRunning) {
    console.log('[TRIGGER] Rainfall check already running, skipping');
    return;
  }
  
  isRunning = true;
  
  try {
    for (const zone of ZONES) {
      try {
        const res = await axios.get(`${process.env.OPENWEATHER_BASE_URL}/weather`, {
          params: {
            lat: zone.lat,
            lon: zone.lon,
            appid: process.env.OPENWEATHER_API_KEY,
            units: 'metric'
          },
          timeout: 10000 // 10 second timeout
        });

        const rainfall = res.data.rain?.['1h'] || 0;

        if (rainfall > RAINFALL_THRESHOLD) {
          // Check if trigger already active for this zone
          const redisKey = `trigger:rainfall:${zone.name}`;
          const existing = await redis.get(redisKey);

          if (!existing) {
            // Log trigger event to Supabase
            const { data: triggerEvent } = await supabase
              .from('trigger_events')
              .insert({
                trigger_type: 'heavy_rainfall',
                zone: zone.name,
                reading_value: rainfall,
                reading_unit: 'mm/hr',
                threshold_value: RAINFALL_THRESHOLD,
                disruption_start: new Date().toISOString(),
                is_active: true,
                data_source: 'openweathermap'
              })
              .select()
              .single();

            // Mark as active in Redis (expires after 2 hours)
            await redis.setex(redisKey, 7200, triggerEvent.id);

            // Push to claims queue
            await redis.lpush('claims:queue', JSON.stringify({
              trigger_event_id: triggerEvent.id,
              trigger_type: 'heavy_rainfall',
              zone: zone.name,
              disruption_start: triggerEvent.disruption_start
            }));

            console.log(`[TRIGGER] Heavy rainfall in ${zone.name}: ${rainfall}mm/hr`);
          }
        } else {
          // Rainfall stopped — close active trigger if exists
          const redisKey = `trigger:rainfall:${zone.name}`;
          const triggerEventId = await redis.get(redisKey);

          if (triggerEventId) {
            await supabase
              .from('trigger_events')
              .update({
                disruption_end: new Date().toISOString(),
                is_active: false
              })
              .eq('id', triggerEventId);

            await redis.del(redisKey);
            console.log(`[TRIGGER] Rainfall cleared in ${zone.name}`);
          }
        }
      } catch (err) {
        console.error(`[TRIGGER ERROR] Rainfall check failed for ${zone.name}:`, err.message);
        // Continue with other zones even if one fails
      }
    }
  } finally {
    isRunning = false;
  }
}

// Run every 15 minutes
cron.schedule('*/15 * * * *', checkRainfall);

module.exports = { checkRainfall };