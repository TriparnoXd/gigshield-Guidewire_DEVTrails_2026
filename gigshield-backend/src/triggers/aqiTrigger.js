const cron = require('node-cron');
const axios = require('axios');
const supabase = require('../config/supabase');
const redis = require('../config/redis');

// Bengaluru zones
const ZONES = [
  { name: 'Koramangala', lat: 12.9352, lon: 77.6245 },
  { name: 'Whitefield',  lat: 12.9698, lon: 77.7499 },
  { name: 'Indiranagar', lat: 12.9784, lon: 77.6408 },
  { name: 'Hebbal',      lat: 13.0358, lon: 77.5970 },
  { name: 'HSR Layout',  lat: 12.9116, lon: 77.6389 },
];

const AQI_THRESHOLD = 300; // PM2.5 AQI

// Lock to prevent overlapping executions
let isRunning = false;

async function checkAQI() {
  // Prevent overlapping executions
  if (isRunning) {
    console.log('[TRIGGER] AQI check already running, skipping');
    return;
  }
  
  isRunning = true;
  
  try {
    for (const zone of ZONES) {
      try {
        // OpenAQ API for PM2.5 measurements
        const res = await axios.get(`${process.env.OPENAQ_BASE_URL}/measurements`, {
          params: {
            coordinates: `${zone.lat},${zone.lon}`,
            parameter: 'pm25',
            radius: 5000, // 5km radius
            limit: 1,
            sort: 'desc'
          },
          timeout: 10000 // 10 second timeout
        });

        const measurements = res.data.results;
        if (!measurements || measurements.length === 0) continue;

        const aqi = measurements[0].value;

        if (aqi > AQI_THRESHOLD) {
          const redisKey = `trigger:aqi:${zone.name}`;
          const existing = await redis.get(redisKey);

          if (!existing) {
            const { data: triggerEvent } = await supabase
              .from('trigger_events')
              .insert({
                trigger_type: 'severe_aqi',
                zone: zone.name,
                reading_value: aqi,
                reading_unit: 'AQI',
                threshold_value: AQI_THRESHOLD,
                disruption_start: new Date().toISOString(),
                is_active: true,
                data_source: 'openaq'
              })
              .select()
              .single();

            await redis.setex(redisKey, 7200, triggerEvent.id);

            await redis.lpush('claims:queue', JSON.stringify({
              trigger_event_id: triggerEvent.id,
              trigger_type: 'severe_aqi',
              zone: zone.name,
              disruption_start: triggerEvent.disruption_start
            }));

            console.log(`[TRIGGER] Severe AQI in ${zone.name}: ${aqi} AQI`);
          }
        } else {
          const redisKey = `trigger:aqi:${zone.name}`;
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
            console.log(`[TRIGGER] AQI cleared in ${zone.name}`);
          }
        }
      } catch (err) {
        console.error(`[TRIGGER ERROR] AQI check failed for ${zone.name}:`, err.message);
        // Continue with other zones even if one fails
      }
    }
  } finally {
    isRunning = false;
  }
}

// Run every 15 minutes
cron.schedule('*/15 * * * *', checkAQI);

module.exports = { checkAQI };